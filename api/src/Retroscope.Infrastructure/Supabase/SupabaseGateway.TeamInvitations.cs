using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Retroscope.Application.DTOs.TeamInvitations;

namespace Retroscope.Infrastructure.Supabase;

public sealed partial class SupabaseGateway
{
    public async Task<IReadOnlyList<TeamInvitationItem>> GetTeamInvitationsAsync(
        string teamId,
        string? inviteType,
        string? status,
        string authorizationHeader,
        CancellationToken ct)
    {
        var queryParams = new List<string>
        {
            $"team_id=eq.{teamId}",
            "select=*",
            "order=created_at.desc"
        };

        if (!string.IsNullOrWhiteSpace(inviteType))
        {
            queryParams.Add($"invite_type=eq.{inviteType}");
        }

        if (!string.IsNullOrWhiteSpace(status))
        {
            queryParams.Add($"status=eq.{status}");
        }

        var url = $"team_invitations?{string.Join("&", queryParams)}";

        var request = new HttpRequestMessage(HttpMethod.Get, url);
        request.Headers.Add("Authorization", authorizationHeader.Replace("Bearer ", "").Trim());
        request.Headers.Add("apikey", _supabaseAnonKey);

        var response = await _postgrestClient.SendAsync(request, ct);

        if (response.StatusCode == System.Net.HttpStatusCode.Unauthorized ||
            response.StatusCode == System.Net.HttpStatusCode.Forbidden)
        {
            throw new UnauthorizedAccessException("Not authorized to access these invitations");
        }

        response.EnsureSuccessStatusCode();

        var records = await response.Content.ReadFromJsonAsync<List<TeamInvitationRecord>>(cancellationToken: ct)
            ?? new List<TeamInvitationRecord>();

        return records.Select(r => new TeamInvitationItem
        {
            Id = r.Id,
            TeamId = r.Team_Id,
            Email = r.Email,
            InvitedBy = r.Invited_By,
            Token = r.Token,
            Status = r.Status,
            InviteType = r.Invite_Type,
            IsActive = r.Is_Active,
            ExpiresAt = r.Expires_At,
            CreatedAt = r.Created_At
        }).ToList();
    }

    public async Task<TeamInvitationItem> CreateTeamInvitationAsync(
        string teamId,
        CreateTeamInvitationRequest request,
        string userId,
        string authorizationHeader,
        CancellationToken ct)
    {
        var url = "team_invitations";

        var payload = new
        {
            team_id = teamId,
            email = request.Email,
            invited_by = userId,
            invite_type = request.InviteType
        };

        var requestMessage = new HttpRequestMessage(HttpMethod.Post, url)
        {
            Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json")
        };
        requestMessage.Headers.Add("Authorization", authorizationHeader.Replace("Bearer ", "").Trim());
        requestMessage.Headers.Add("apikey", _supabaseAnonKey);
        requestMessage.Headers.Add("Prefer", "return=representation");

        var response = await _postgrestClient.SendAsync(requestMessage, ct);

        if (response.StatusCode == System.Net.HttpStatusCode.Unauthorized ||
            response.StatusCode == System.Net.HttpStatusCode.Forbidden)
        {
            throw new UnauthorizedAccessException("Not authorized to create invitations");
        }

        response.EnsureSuccessStatusCode();

        var records = await response.Content.ReadFromJsonAsync<List<TeamInvitationRecord>>(cancellationToken: ct);
        if (records == null || records.Count == 0)
        {
            throw new InvalidOperationException("Failed to create invitation");
        }

        var record = records[0];
        return new TeamInvitationItem
        {
            Id = record.Id,
            TeamId = record.Team_Id,
            Email = record.Email,
            InvitedBy = record.Invited_By,
            Token = record.Token,
            Status = record.Status,
            InviteType = record.Invite_Type,
            IsActive = record.Is_Active,
            ExpiresAt = record.Expires_At,
            CreatedAt = record.Created_At
        };
    }

    public async Task UpdateTeamInvitationAsync(
        string invitationId,
        UpdateTeamInvitationRequest request,
        string authorizationHeader,
        CancellationToken ct)
    {
        var url = $"team_invitations?id=eq.{invitationId}";

        var payload = new
        {
            is_active = request.IsActive
        };

        var requestMessage = new HttpRequestMessage(HttpMethod.Patch, url)
        {
            Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json")
        };
        requestMessage.Headers.Add("Authorization", authorizationHeader.Replace("Bearer ", "").Trim());
        requestMessage.Headers.Add("apikey", _supabaseAnonKey);

        var response = await _postgrestClient.SendAsync(requestMessage, ct);

        if (response.StatusCode == System.Net.HttpStatusCode.Unauthorized ||
            response.StatusCode == System.Net.HttpStatusCode.Forbidden)
        {
            throw new UnauthorizedAccessException("Not authorized to update this invitation");
        }

        response.EnsureSuccessStatusCode();
    }

    public async Task DeleteTeamInvitationAsync(
        string invitationId,
        string authorizationHeader,
        CancellationToken ct)
    {
        var url = $"team_invitations?id=eq.{invitationId}";

        var requestMessage = new HttpRequestMessage(HttpMethod.Delete, url);
        requestMessage.Headers.Add("Authorization", authorizationHeader.Replace("Bearer ", "").Trim());
        requestMessage.Headers.Add("apikey", _supabaseAnonKey);

        var response = await _postgrestClient.SendAsync(requestMessage, ct);

        if (response.StatusCode == System.Net.HttpStatusCode.Unauthorized ||
            response.StatusCode == System.Net.HttpStatusCode.Forbidden)
        {
            throw new UnauthorizedAccessException("Not authorized to delete this invitation");
        }

        response.EnsureSuccessStatusCode();
    }

    // Internal record for deserialization (snake_case from Supabase)
    private sealed class TeamInvitationRecord
    {
        public string Id { get; set; } = string.Empty;
        public string Team_Id { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string Invited_By { get; set; } = string.Empty;
        public string Token { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public string Invite_Type { get; set; } = string.Empty;
        public bool Is_Active { get; set; }
        public string Expires_At { get; set; } = string.Empty;
        public string Created_At { get; set; } = string.Empty;
    }
}

