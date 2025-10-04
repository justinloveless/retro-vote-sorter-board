using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Retroscope.Application.DTOs.RetroComments;

namespace Retroscope.Infrastructure.Supabase;

public sealed partial class SupabaseGateway
{
    public async Task<List<RetroCommentItem>> GetRetroCommentsByItemIdsAsync(List<string> itemIds, string authorizationHeader, CancellationToken ct)
    {
        if (itemIds.Count == 0)
        {
            return new List<RetroCommentItem>();
        }

        // Build the "in" query for multiple item IDs
        var itemIdsFilter = $"({string.Join(",", itemIds)})";
        var url = $"retro_comments?item_id=in.{itemIdsFilter}&select=*,profiles(avatar_url,full_name)&order=created_at.asc";

        var request = new HttpRequestMessage(HttpMethod.Get, url);
        request.Headers.Add("Authorization", authorizationHeader.Replace("Bearer ", "").Trim());
        request.Headers.Add("apikey", _supabaseAnonKey);

        var response = await _postgrestClient.SendAsync(request, ct);

        if (response.StatusCode == HttpStatusCode.Unauthorized || response.StatusCode == HttpStatusCode.Forbidden)
        {
            throw new UnauthorizedAccessException("Not authorized to access comments.");
        }

        response.EnsureSuccessStatusCode();

        var comments = await response.Content.ReadFromJsonAsync<List<RetroCommentRecord>>(cancellationToken: ct)
                        ?? new List<RetroCommentRecord>();

        return comments.Select(MapToRetroCommentItem).ToList();
    }

    public async Task<List<RetroCommentItem>> GetRetroCommentsByItemIdAsync(string itemId, string authorizationHeader, CancellationToken ct)
    {
        var url = $"retro_comments?item_id=eq.{itemId}&select=*,profiles(avatar_url,full_name)&order=created_at.asc";

        var request = new HttpRequestMessage(HttpMethod.Get, url);
        request.Headers.Add("Authorization", authorizationHeader.Replace("Bearer ", "").Trim());
        request.Headers.Add("apikey", _supabaseAnonKey);

        var response = await _postgrestClient.SendAsync(request, ct);

        if (response.StatusCode == HttpStatusCode.Unauthorized || response.StatusCode == HttpStatusCode.Forbidden)
        {
            throw new UnauthorizedAccessException("Not authorized to access comments.");
        }

        response.EnsureSuccessStatusCode();

        var comments = await response.Content.ReadFromJsonAsync<List<RetroCommentRecord>>(cancellationToken: ct)
                        ?? new List<RetroCommentRecord>();

        return comments.Select(MapToRetroCommentItem).ToList();
    }

    public async Task<RetroCommentItem> CreateRetroCommentAsync(CreateRetroCommentRequest request, string authorizationHeader, CancellationToken ct)
    {
        var payload = new
        {
            item_id = request.ItemId,
            text = request.Text,
            author = request.Author,
            author_id = request.AuthorId,
            session_id = request.SessionId
        };

        var httpRequest = new HttpRequestMessage(HttpMethod.Post, "retro_comments");
        httpRequest.Headers.Add("Authorization", authorizationHeader.Replace("Bearer ", "").Trim());
        httpRequest.Headers.Add("apikey", _supabaseAnonKey);
        httpRequest.Headers.Add("Prefer", "return=representation");
        httpRequest.Content = new StringContent(JsonSerializer.Serialize(payload), System.Text.Encoding.UTF8, "application/json");

        var response = await _postgrestClient.SendAsync(httpRequest, ct);

        if (response.StatusCode == HttpStatusCode.Unauthorized || response.StatusCode == HttpStatusCode.Forbidden)
        {
            throw new UnauthorizedAccessException("Not authorized to create comment.");
        }

        response.EnsureSuccessStatusCode();

        var newComment = await response.Content.ReadFromJsonAsync<RetroCommentRecord>(cancellationToken: ct);
        if (newComment == null)
        {
            throw new InvalidOperationException("Failed to deserialize new comment from Supabase.");
        }

        return MapToRetroCommentItem(newComment);
    }

    public async Task DeleteRetroCommentAsync(string commentId, string authorizationHeader, CancellationToken ct)
    {
        var httpRequest = new HttpRequestMessage(HttpMethod.Delete, $"retro_comments?id=eq.{commentId}");
        httpRequest.Headers.Add("Authorization", authorizationHeader.Replace("Bearer ", "").Trim());
        httpRequest.Headers.Add("apikey", _supabaseAnonKey);
        httpRequest.Headers.Add("Prefer", "return=minimal");

        var response = await _postgrestClient.SendAsync(httpRequest, ct);

        if (response.StatusCode == HttpStatusCode.Unauthorized || response.StatusCode == HttpStatusCode.Forbidden)
        {
            throw new UnauthorizedAccessException("Not authorized to delete comment.");
        }
        if (response.StatusCode == HttpStatusCode.NotFound)
        {
            throw new KeyNotFoundException($"Comment with ID {commentId} not found.");
        }

        response.EnsureSuccessStatusCode();
    }

    private static RetroCommentItem MapToRetroCommentItem(RetroCommentRecord record)
    {
        return new RetroCommentItem
        {
            Id = record.Id,
            ItemId = record.Item_Id,
            Text = record.Text,
            Author = record.Author,
            AuthorId = record.Author_Id,
            SessionId = record.Session_Id,
            CreatedAt = record.Created_At,
            Profile = record.Profiles != null ? new ProfileInfo
            {
                AvatarUrl = record.Profiles.Avatar_Url,
                FullName = record.Profiles.Full_Name
            } : null
        };
    }

    private sealed class RetroCommentRecord
    {
        public string Id { get; set; } = string.Empty;
        public string Item_Id { get; set; } = string.Empty;
        public string Text { get; set; } = string.Empty;
        public string Author { get; set; } = string.Empty;
        public string? Author_Id { get; set; }
        public string? Session_Id { get; set; }
        public string Created_At { get; set; } = string.Empty;
        public RetroCommentProfileRecord? Profiles { get; set; }
    }

    private sealed class RetroCommentProfileRecord
    {
        public string? Avatar_Url { get; set; }
        public string? Full_Name { get; set; }
    }
}

