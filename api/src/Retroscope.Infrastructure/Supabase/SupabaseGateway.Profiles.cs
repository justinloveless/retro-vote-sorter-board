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

    public async Task<List<ProfileItem>> GetProfilesByIdsAsync(List<string> userIds, string authorizationHeader, CancellationToken ct)
    {
        if (userIds.Count == 0)
        {
            return new List<ProfileItem>();
        }

        var userIdsFilter = $"({string.Join(",", userIds)})";
        var url = $"profiles?id=in.{userIdsFilter}&select=id,full_name,avatar_url,role,theme_preference,background_preference";

        var request = new HttpRequestMessage(HttpMethod.Get, url);
        request.Headers.Add("Authorization", authorizationHeader.Replace("Bearer ", "").Trim());
        request.Headers.Add("apikey", _supabaseAnonKey);

        var response = await _postgrestClient.SendAsync(request, ct);

        if (response.StatusCode == System.Net.HttpStatusCode.Unauthorized ||
            response.StatusCode == System.Net.HttpStatusCode.Forbidden)
        {
            throw new UnauthorizedAccessException("Not authorized to access profiles");
        }

        response.EnsureSuccessStatusCode();

        var profiles = await response.Content.ReadFromJsonAsync<List<ProfileRecord>>(cancellationToken: ct)
            ?? new List<ProfileRecord>();

        return profiles.Select(record => new ProfileItem
        {
            Id = record.Id,
            FullName = record.Full_Name,
            AvatarUrl = record.Avatar_Url,
            Role = record.Role,
            ThemePreference = record.Theme_Preference,
            BackgroundPreference = record.Background_Preference
        }).ToList();
    }

    public async Task<ProfileItem> UpdateProfileAsync(string userId, UpdateProfileRequest request, string authorizationHeader, CancellationToken ct)
    {
        var payload = new Dictionary<string, object?>();

        if (request.FullName != null) payload["full_name"] = request.FullName;
        if (request.AvatarUrl != null) payload["avatar_url"] = request.AvatarUrl;
        if (request.ThemePreference != null) payload["theme_preference"] = request.ThemePreference;
        if (request.BackgroundPreference != null) payload["background_preference"] = request.BackgroundPreference;

        var httpRequest = new HttpRequestMessage(new HttpMethod("PATCH"), $"profiles?id=eq.{userId}");
        httpRequest.Headers.Add("Authorization", authorizationHeader.Replace("Bearer ", "").Trim());
        httpRequest.Headers.Add("apikey", _supabaseAnonKey);
        httpRequest.Headers.Add("Prefer", "return=representation");
        httpRequest.Content = new StringContent(JsonSerializer.Serialize(payload), System.Text.Encoding.UTF8, "application/json");

        var response = await _postgrestClient.SendAsync(httpRequest, ct);

        if (response.StatusCode == System.Net.HttpStatusCode.Unauthorized ||
            response.StatusCode == System.Net.HttpStatusCode.Forbidden)
        {
            throw new UnauthorizedAccessException("Not authorized to update this profile");
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

    public async Task UpsertProfileAsync(string userId, UpdateProfileRequest request, string authorizationHeader, CancellationToken ct)
    {
        var payload = new Dictionary<string, object?>
        {
            ["id"] = userId
        };

        if (request.FullName != null) payload["full_name"] = request.FullName;
        if (request.AvatarUrl != null) payload["avatar_url"] = request.AvatarUrl;
        if (request.ThemePreference != null) payload["theme_preference"] = request.ThemePreference;
        if (request.BackgroundPreference != null) payload["background_preference"] = request.BackgroundPreference;

        var httpRequest = new HttpRequestMessage(HttpMethod.Post, "profiles");
        httpRequest.Headers.Add("Authorization", authorizationHeader.Replace("Bearer ", "").Trim());
        httpRequest.Headers.Add("apikey", _supabaseAnonKey);
        httpRequest.Headers.Add("Prefer", "resolution=merge-duplicates,return=minimal");
        httpRequest.Content = new StringContent(JsonSerializer.Serialize(payload), System.Text.Encoding.UTF8, "application/json");

        var response = await _postgrestClient.SendAsync(httpRequest, ct);

        if (response.StatusCode == System.Net.HttpStatusCode.Unauthorized ||
            response.StatusCode == System.Net.HttpStatusCode.Forbidden)
        {
            throw new UnauthorizedAccessException("Not authorized to upsert this profile");
        }

        response.EnsureSuccessStatusCode();
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

