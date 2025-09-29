using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Retroscope.Application.DTOs;
using Retroscope.Application.DTOs.FeatureFlags;

namespace Retroscope.Infrastructure.Supabase;

public partial class SupabaseGateway
{
    public async Task<FeatureFlagsResponse> GetFeatureFlagsAsync(string bearerToken, string? correlationId = null, CancellationToken cancellationToken = default)
    {
        try
        {
            var req = new HttpRequestMessage(HttpMethod.Get, "feature_flags?select=*");
            req.Headers.Authorization = AuthenticationHeaderValue.Parse(bearerToken);
            if (!string.IsNullOrEmpty(_supabaseAnonKey)) req.Headers.TryAddWithoutValidation("apikey", _supabaseAnonKey);
            if (!string.IsNullOrEmpty(correlationId)) req.Headers.Add("X-Correlation-Id", correlationId);

            var resp = await _postgrestClient.SendAsync(req, cancellationToken);
            if (!resp.IsSuccessStatusCode) throw new HttpException(resp.StatusCode, $"Supabase request failed with status {resp.StatusCode}");

            var json = await resp.Content.ReadAsStringAsync(cancellationToken);
            var rows = JsonSerializer.Deserialize<List<JsonElement>>(json, new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? new();
            var items = rows.Select(r => new FeatureFlagItem
            {
                FlagName = r.TryGetProperty("flag_name", out var fn) ? fn.GetString() ?? string.Empty : string.Empty,
                Description = r.TryGetProperty("description", out var ds) ? ds.GetString() : null,
                IsEnabled = r.TryGetProperty("is_enabled", out var en) && en.ValueKind == JsonValueKind.True
            }).ToList();

            return new FeatureFlagsResponse { Items = items };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching feature flags");
            throw;
        }
    }

    public async Task<bool> UpdateFeatureFlagAsync(string bearerToken, string flagName, bool isEnabled, string? correlationId = null, CancellationToken cancellationToken = default)
    {
        try
        {
            var body = JsonSerializer.Serialize(new { is_enabled = isEnabled });
            var content = new StringContent(body, Encoding.UTF8, "application/json");
            var req = new HttpRequestMessage(HttpMethod.Patch, $"feature_flags?flag_name=eq.{flagName}") { Content = content };
            req.Headers.Authorization = AuthenticationHeaderValue.Parse(bearerToken);
            if (!string.IsNullOrEmpty(_supabaseAnonKey)) req.Headers.TryAddWithoutValidation("apikey", _supabaseAnonKey);
            if (!string.IsNullOrEmpty(correlationId)) req.Headers.Add("X-Correlation-Id", correlationId);

            var resp = await _postgrestClient.SendAsync(req, cancellationToken);
            return resp.IsSuccessStatusCode;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating feature flag {Flag}", flagName);
            throw;
        }
    }
}


