using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Retroscope.Application.DTOs.RetroBoards;

namespace Retroscope.Infrastructure.Supabase;

public sealed partial class SupabaseGateway
{
    public async Task<List<RetroBoardItem>> GetRetroBoardsAsync(string teamId, bool includeDeleted, string authorizationHeader, CancellationToken ct)
    {
        var deletedFilter = includeDeleted ? "" : "&deleted=eq.false";
        var url = $"retro_boards?team_id=eq.{teamId}{deletedFilter}&order=created_at.desc";

        var request = new HttpRequestMessage(HttpMethod.Get, url);
        request.Headers.Add("Authorization", authorizationHeader.Replace("Bearer ", "").Trim());
        request.Headers.Add("apikey", _supabaseAnonKey);

        var response = await _postgrestClient.SendAsync(request, ct);

        if (response.StatusCode == HttpStatusCode.Unauthorized || response.StatusCode == HttpStatusCode.Forbidden)
        {
            throw new UnauthorizedAccessException("Not authorized to access retro boards.");
        }

        response.EnsureSuccessStatusCode();

        var boards = await response.Content.ReadFromJsonAsync<List<RetroBoardRecord>>(cancellationToken: ct)
                     ?? new List<RetroBoardRecord>();

        return boards.Select(MapToRetroBoardItem).ToList();
    }

    public async Task<RetroBoardItem?> GetRetroBoardByRoomIdAsync(string roomId, string authorizationHeader, CancellationToken ct)
    {
        var url = $"retro_boards?room_id=eq.{roomId}";

        var request = new HttpRequestMessage(HttpMethod.Get, url);
        request.Headers.Add("Authorization", authorizationHeader.Replace("Bearer ", "").Trim());
        request.Headers.Add("apikey", _supabaseAnonKey);

        var response = await _postgrestClient.SendAsync(request, ct);

        if (response.StatusCode == HttpStatusCode.Unauthorized || response.StatusCode == HttpStatusCode.Forbidden)
        {
            throw new UnauthorizedAccessException("Not authorized to access retro board.");
        }

        response.EnsureSuccessStatusCode();

        var boards = await response.Content.ReadFromJsonAsync<List<RetroBoardRecord>>(cancellationToken: ct);
        var board = boards?.FirstOrDefault();

        return board != null ? MapToRetroBoardItem(board) : null;
    }

    public async Task<RetroBoardItem> CreateRetroBoardAsync(CreateRetroBoardRequest request, string authorizationHeader, CancellationToken ct)
    {
        var payload = new
        {
            room_id = request.RoomId,
            title = request.Title,
            is_private = request.IsPrivate,
            password_hash = request.PasswordHash,
            team_id = request.TeamId,
            creator_id = request.CreatorId
        };

        var httpRequest = new HttpRequestMessage(HttpMethod.Post, "retro_boards");
        httpRequest.Headers.Add("Authorization", authorizationHeader.Replace("Bearer ", "").Trim());
        httpRequest.Headers.Add("apikey", _supabaseAnonKey);
        httpRequest.Headers.Add("Prefer", "return=representation");
        httpRequest.Content = new StringContent(JsonSerializer.Serialize(payload), System.Text.Encoding.UTF8, "application/json");

        var response = await _postgrestClient.SendAsync(httpRequest, ct);

        if (response.StatusCode == HttpStatusCode.Unauthorized || response.StatusCode == HttpStatusCode.Forbidden)
        {
            throw new UnauthorizedAccessException("Not authorized to create retro board.");
        }

        response.EnsureSuccessStatusCode();

        var newBoard = await response.Content.ReadFromJsonAsync<RetroBoardRecord>(cancellationToken: ct);
        if (newBoard == null)
        {
            throw new InvalidOperationException("Failed to deserialize new retro board from Supabase.");
        }

        return MapToRetroBoardItem(newBoard);
    }

    public async Task UpdateRetroBoardAsync(string boardId, UpdateRetroBoardRequest request, string authorizationHeader, CancellationToken ct)
    {
        var payload = new Dictionary<string, object?>();

        if (request.Title != null) payload["title"] = request.Title;
        if (request.IsPrivate.HasValue) payload["is_private"] = request.IsPrivate.Value;
        if (request.PasswordHash != null) payload["password_hash"] = request.PasswordHash;
        if (request.Archived.HasValue) payload["archived"] = request.Archived.Value;
        if (request.ArchivedAt != null) payload["archived_at"] = request.ArchivedAt;
        if (request.ArchivedBy != null) payload["archived_by"] = request.ArchivedBy;
        if (request.Deleted.HasValue) payload["deleted"] = request.Deleted.Value;
        if (request.RetroStage != null) payload["retro_stage"] = request.RetroStage;

        var httpRequest = new HttpRequestMessage(new HttpMethod("PATCH"), $"retro_boards?id=eq.{boardId}");
        httpRequest.Headers.Add("Authorization", authorizationHeader.Replace("Bearer ", "").Trim());
        httpRequest.Headers.Add("apikey", _supabaseAnonKey);
        httpRequest.Headers.Add("Prefer", "return=minimal");
        httpRequest.Content = new StringContent(JsonSerializer.Serialize(payload), System.Text.Encoding.UTF8, "application/json");

        var response = await _postgrestClient.SendAsync(httpRequest, ct);

        if (response.StatusCode == HttpStatusCode.Unauthorized || response.StatusCode == HttpStatusCode.Forbidden)
        {
            throw new UnauthorizedAccessException("Not authorized to update retro board.");
        }
        if (response.StatusCode == HttpStatusCode.NotFound)
        {
            throw new KeyNotFoundException($"Retro board with ID {boardId} not found.");
        }

        response.EnsureSuccessStatusCode();
    }

    public async Task DeleteRetroBoardAsync(string boardId, string authorizationHeader, CancellationToken ct)
    {
        var httpRequest = new HttpRequestMessage(HttpMethod.Delete, $"retro_boards?id=eq.{boardId}");
        httpRequest.Headers.Add("Authorization", authorizationHeader.Replace("Bearer ", "").Trim());
        httpRequest.Headers.Add("apikey", _supabaseAnonKey);
        httpRequest.Headers.Add("Prefer", "return=minimal");

        var response = await _postgrestClient.SendAsync(httpRequest, ct);

        if (response.StatusCode == HttpStatusCode.Unauthorized || response.StatusCode == HttpStatusCode.Forbidden)
        {
            throw new UnauthorizedAccessException("Not authorized to delete retro board.");
        }
        if (response.StatusCode == HttpStatusCode.NotFound)
        {
            throw new KeyNotFoundException($"Retro board with ID {boardId} not found.");
        }

        response.EnsureSuccessStatusCode();
    }

    public async Task<RetroBoardSummaryResponse?> GetRetroBoardSummaryAsync(string roomId, string authorizationHeader, CancellationToken ct)
    {
        // Fetch board with team info and members
        var url = $"retro_boards?room_id=eq.{roomId}&select=*,teams(id,name,team_members(user_id,role))";

        var request = new HttpRequestMessage(HttpMethod.Get, url);
        request.Headers.Add("Authorization", authorizationHeader.Replace("Bearer ", "").Trim());
        request.Headers.Add("apikey", _supabaseAnonKey);

        var response = await _postgrestClient.SendAsync(request, ct);

        if (response.StatusCode == HttpStatusCode.Unauthorized || response.StatusCode == HttpStatusCode.Forbidden)
        {
            throw new UnauthorizedAccessException("Not authorized to access retro board summary.");
        }

        response.EnsureSuccessStatusCode();

        var boards = await response.Content.ReadFromJsonAsync<List<RetroBoardSummaryRecord>>(cancellationToken: ct);
        var boardRecord = boards?.FirstOrDefault();

        if (boardRecord == null)
        {
            return null;
        }

        var summary = new RetroBoardSummaryResponse
        {
            Board = new RetroBoardItem
            {
                Id = boardRecord.Id,
                RoomId = boardRecord.Room_Id,
                Title = boardRecord.Title,
                IsPrivate = boardRecord.Is_Private,
                PasswordHash = boardRecord.Password_Hash,
                Archived = boardRecord.Archived,
                ArchivedAt = boardRecord.Archived_At,
                ArchivedBy = boardRecord.Archived_By,
                Deleted = boardRecord.Deleted,
                TeamId = boardRecord.Team_Id,
                RetroStage = boardRecord.Retro_Stage,
                CreatorId = boardRecord.Creator_Id,
                CreatedAt = boardRecord.Created_At,
                UpdatedAt = boardRecord.Updated_At
            }
        };

        if (boardRecord.Teams != null)
        {
            summary.Team = new TeamInfo
            {
                Id = boardRecord.Teams.Id,
                Name = boardRecord.Teams.Name,
                Members = (boardRecord.Teams.Team_Members ?? new List<TeamMemberRecord>())
                    .Select(m => new TeamMemberInfo
                    {
                        UserId = m.User_Id,
                        Role = m.Role
                    })
                    .ToList()
            };
        }

        return summary;
    }

    public async Task<List<BoardTitleItem>> GetRetroBoardTitlesByIdsAsync(List<string> boardIds, string authorizationHeader, CancellationToken ct)
    {
        if (boardIds.Count == 0)
        {
            return new List<BoardTitleItem>();
        }

        var boardIdsFilter = $"({string.Join(",", boardIds)})";
        var url = $"retro_boards?id=in.{boardIdsFilter}&select=id,title";

        var request = new HttpRequestMessage(HttpMethod.Get, url);
        request.Headers.Add("Authorization", authorizationHeader.Replace("Bearer ", "").Trim());
        request.Headers.Add("apikey", _supabaseAnonKey);

        var response = await _postgrestClient.SendAsync(request, ct);

        if (response.StatusCode == HttpStatusCode.Unauthorized || response.StatusCode == HttpStatusCode.Forbidden)
        {
            throw new UnauthorizedAccessException("Not authorized to access retro boards.");
        }

        response.EnsureSuccessStatusCode();

        var boards = await response.Content.ReadFromJsonAsync<List<BoardTitleRecord>>(cancellationToken: ct)
                     ?? new List<BoardTitleRecord>();

        return boards.Select(b => new BoardTitleItem
        {
            Id = b.Id,
            Title = b.Title
        }).ToList();
    }

    private static RetroBoardItem MapToRetroBoardItem(RetroBoardRecord record)
    {
        return new RetroBoardItem
        {
            Id = record.Id,
            RoomId = record.Room_Id,
            Title = record.Title,
            IsPrivate = record.Is_Private,
            PasswordHash = record.Password_Hash,
            Archived = record.Archived,
            ArchivedAt = record.Archived_At,
            ArchivedBy = record.Archived_By,
            Deleted = record.Deleted,
            TeamId = record.Team_Id,
            RetroStage = record.Retro_Stage,
            CreatorId = record.Creator_Id,
            CreatedAt = record.Created_At,
            UpdatedAt = record.Updated_At
        };
    }

    private sealed class RetroBoardRecord
    {
        public string Id { get; set; } = string.Empty;
        public string Room_Id { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
        public bool Is_Private { get; set; }
        public string? Password_Hash { get; set; }
        public bool Archived { get; set; }
        public string? Archived_At { get; set; }
        public string? Archived_By { get; set; }
        public bool Deleted { get; set; }
        public string? Team_Id { get; set; }
        public string? Retro_Stage { get; set; }
        public string? Creator_Id { get; set; }
        public string Created_At { get; set; } = string.Empty;
        public string Updated_At { get; set; } = string.Empty;
    }

    private sealed class RetroBoardSummaryRecord
    {
        public string Id { get; set; } = string.Empty;
        public string Room_Id { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
        public bool Is_Private { get; set; }
        public string? Password_Hash { get; set; }
        public bool Archived { get; set; }
        public string? Archived_At { get; set; }
        public string? Archived_By { get; set; }
        public bool Deleted { get; set; }
        public string? Team_Id { get; set; }
        public string? Retro_Stage { get; set; }
        public string? Creator_Id { get; set; }
        public string Created_At { get; set; } = string.Empty;
        public string Updated_At { get; set; } = string.Empty;
        public TeamRecord? Teams { get; set; }
    }

    private sealed class TeamRecord
    {
        public string Id { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public List<TeamMemberRecord>? Team_Members { get; set; }
    }

    private sealed class TeamMemberRecord
    {
        public string User_Id { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;
    }

    private sealed class BoardTitleRecord
    {
        public string Id { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
    }
}
