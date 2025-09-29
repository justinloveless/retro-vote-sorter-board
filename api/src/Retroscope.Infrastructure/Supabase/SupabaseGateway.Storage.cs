using System.Net.Http.Headers;
using Microsoft.Extensions.Logging;
using Retroscope.Application.DTOs;
using Retroscope.Application.DTOs.Storage;

namespace Retroscope.Infrastructure.Supabase;

public partial class SupabaseGateway
{
    public async Task<AvatarUploadResponse> UploadAvatarAsync(string bearerToken, string userId, byte[] bytes, string contentType, string? correlationId = null, CancellationToken cancellationToken = default)
    {
        try
        {
            var fileName = $"{userId}.png";
            var request = new HttpRequestMessage(HttpMethod.Post, $"/storage/v1/object/avatars/{fileName}");
            var multipart = new MultipartFormDataContent();
            var fileContent = new ByteArrayContent(bytes);
            fileContent.Headers.ContentType = new MediaTypeHeaderValue(string.IsNullOrWhiteSpace(contentType) ? "image/png" : contentType);
            multipart.Add(fileContent, "file", fileName);
            request.Content = multipart;
            request.Headers.Authorization = AuthenticationHeaderValue.Parse(bearerToken);
            request.Headers.TryAddWithoutValidation("x-upsert", "true");
            if (!string.IsNullOrEmpty(_supabaseAnonKey)) request.Headers.TryAddWithoutValidation("apikey", _supabaseAnonKey);
            if (!string.IsNullOrEmpty(correlationId)) request.Headers.Add("X-Correlation-Id", correlationId);

            var baseUrl = _postgrestClient.BaseAddress?.ToString() ?? string.Empty;
            var root = baseUrl.Replace("/rest/v1", string.Empty).TrimEnd('/');
            request.RequestUri = new Uri($"{root}{request.RequestUri}");

            using var http = new HttpClient();
            http.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
            var resp = await http.SendAsync(request, cancellationToken);
            if (!resp.IsSuccessStatusCode) throw new HttpException(resp.StatusCode, $"Supabase storage upload failed with status {resp.StatusCode}");

            var publicUrl = await GetAvatarPublicUrlAsync(bearerToken, userId, correlationId, cancellationToken);
            return new AvatarUploadResponse { PublicUrl = publicUrl };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error uploading avatar for user {UserId}", userId);
            throw;
        }
    }

    public Task<string> GetAvatarPublicUrlAsync(string bearerToken, string userId, string? correlationId = null, CancellationToken cancellationToken = default)
    {
        var fileName = $"{userId}.png";
        var baseUrl = _postgrestClient.BaseAddress?.ToString() ?? string.Empty;
        var root = baseUrl.Replace("/rest/v1", string.Empty).TrimEnd('/');
        return Task.FromResult($"{root}/storage/v1/object/public/avatars/{fileName}");
    }
}


