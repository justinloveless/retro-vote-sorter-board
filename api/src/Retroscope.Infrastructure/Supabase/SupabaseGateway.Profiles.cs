using System.Net.Http.Json;
using System.Text.Json;
using Retroscope.Application.DTOs.Profiles;

namespace Retroscope.Infrastructure.Supabase;

public sealed partial class SupabaseGateway
{
    public async Task<ProfileItem> GetProfileByIdAsync(string userId, string authorizationHeader, CancellationToken ct)
    {
        var url = $"profiles?id=eq.{userId}&select=id,full_name,avatar_url,role,theme_preference,background_preference";

        var request = new HttpRequestMessage(HttpMethod.Get, url);
        request.Headers.Add("Authorization", authorizationHeader.Replace("Bearer ", "").Trim());
        request.Headers.Add("apikey", _supabaseAnonKey);

        var response = await _postgrestClient.SendAsync(request, ct);

        if (response.StatusCode == System.Net.HttpStatusCode.Unauthorized ||
            response.StatusCode == System.Net.HttpStatusCode.Forbidden)
        {
            throw new UnauthorizedAccessException("Not authorized to access this profile");
        }

        response.EnsureSuccessStatusCode();

        var profiles = await response.Content.ReadFromJsonAsync<List<ProfileRecord>>(cancellationToken: ct)
            ?? new List<ProfileRecord>();

        if (profiles.Count == 0)
        {
            throw new KeyNotFoundException($"Profile not found for user {userId}");
        }

        var record = profiles[0];
        return new ProfileItem
        {
            Id = record.Id,
            FullName = record.Full_Name,
            AvatarUrl = record.Avatar_Url,
            Role = record.Role,
            ThemePreference = record.Theme_Preference,
            BackgroundPreference = record.Background_Preference
        };
    }

    // Internal record for deserialization (snake_case from Supabase)
    private sealed class ProfileRecord
    {
        public string Id { get; set; } = string.Empty;
        public string? Full_Name { get; set; }
        public string? Avatar_Url { get; set; }
        public string? Role { get; set; }
        public string? Theme_Preference { get; set; }
        public JsonElement? Background_Preference { get; set; }
    }
}

