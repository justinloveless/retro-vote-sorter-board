using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Retroscope.Application.DTOs.RetroBoards;
using Retroscope.Application.DTOs.RetroBoardConfig;
using Retroscope.Application.DTOs.RetroColumns;
using Retroscope.Application.DTOs.RetroItems;

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

    public async Task<RetroBoardConfigItem?> GetRetroBoardConfigAsync(string boardId, string authorizationHeader, CancellationToken ct)
    {
        var url = $"retro_board_config?board_id=eq.{boardId}";

        var request = new HttpRequestMessage(HttpMethod.Get, url);
        request.Headers.Add("Authorization", authorizationHeader.Replace("Bearer ", "").Trim());
        request.Headers.Add("apikey", _supabaseAnonKey);

        var response = await _postgrestClient.SendAsync(request, ct);

        if (response.StatusCode == HttpStatusCode.Unauthorized || response.StatusCode == HttpStatusCode.Forbidden)
        {
            throw new UnauthorizedAccessException("Not authorized to access retro board config.");
        }

        response.EnsureSuccessStatusCode();

        var configs = await response.Content.ReadFromJsonAsync<List<RetroBoardConfigRecord>>(cancellationToken: ct)
                     ?? new List<RetroBoardConfigRecord>();

        var configRecord = configs.FirstOrDefault();
        return configRecord != null ? MapToRetroBoardConfigItem(configRecord) : null;
    }

    public async Task<RetroBoardConfigItem> CreateRetroBoardConfigAsync(CreateRetroBoardConfigRequest request, string authorizationHeader, CancellationToken ct)
    {
        var payload = new Dictionary<string, object?>
        {
            ["board_id"] = request.BoardId
        };

        if (request.AllowAnonymous.HasValue) payload["allow_anonymous"] = request.AllowAnonymous.Value;
        if (request.VotingEnabled.HasValue) payload["voting_enabled"] = request.VotingEnabled.Value;
        if (request.MaxVotesPerUser.HasValue) payload["max_votes_per_user"] = request.MaxVotesPerUser.Value;
        if (request.ShowAuthorNames.HasValue) payload["show_author_names"] = request.ShowAuthorNames.Value;
        if (request.RetroStagesEnabled.HasValue) payload["retro_stages_enabled"] = request.RetroStagesEnabled.Value;
        if (request.EnforceStageReadiness.HasValue) payload["enforce_stage_readiness"] = request.EnforceStageReadiness.Value;
        if (request.AllowSelfVotes.HasValue) payload["allow_self_votes"] = request.AllowSelfVotes.Value;
        if (request.VoteEmoji != null) payload["vote_emoji"] = request.VoteEmoji;

        var httpRequest = new HttpRequestMessage(HttpMethod.Post, "retro_board_config");
        httpRequest.Headers.Add("Authorization", authorizationHeader.Replace("Bearer ", "").Trim());
        httpRequest.Headers.Add("apikey", _supabaseAnonKey);
        httpRequest.Headers.Add("Prefer", "return=representation");
        httpRequest.Content = new StringContent(JsonSerializer.Serialize(payload), System.Text.Encoding.UTF8, "application/json");

        var response = await _postgrestClient.SendAsync(httpRequest, ct);

        if (response.StatusCode == HttpStatusCode.Unauthorized || response.StatusCode == HttpStatusCode.Forbidden)
        {
            throw new UnauthorizedAccessException("Not authorized to create retro board config.");
        }

        response.EnsureSuccessStatusCode();

        var newConfig = await response.Content.ReadFromJsonAsync<RetroBoardConfigRecord>(cancellationToken: ct);
        if (newConfig == null)
        {
            throw new InvalidOperationException("Failed to deserialize new retro board config from Supabase.");
        }

        return MapToRetroBoardConfigItem(newConfig);
    }

    public async Task UpdateRetroBoardConfigAsync(string boardId, UpdateRetroBoardConfigRequest request, string authorizationHeader, CancellationToken ct)
    {
        var payload = new Dictionary<string, object?>();

        if (request.AllowAnonymous.HasValue) payload["allow_anonymous"] = request.AllowAnonymous.Value;
        if (request.VotingEnabled.HasValue) payload["voting_enabled"] = request.VotingEnabled.Value;
        if (request.MaxVotesPerUser.HasValue) payload["max_votes_per_user"] = request.MaxVotesPerUser.Value;
        if (request.ShowAuthorNames.HasValue) payload["show_author_names"] = request.ShowAuthorNames.Value;
        if (request.RetroStagesEnabled.HasValue) payload["retro_stages_enabled"] = request.RetroStagesEnabled.Value;
        if (request.EnforceStageReadiness.HasValue) payload["enforce_stage_readiness"] = request.EnforceStageReadiness.Value;
        if (request.AllowSelfVotes.HasValue) payload["allow_self_votes"] = request.AllowSelfVotes.Value;
        if (request.VoteEmoji != null) payload["vote_emoji"] = request.VoteEmoji;

        var httpRequest = new HttpRequestMessage(new HttpMethod("PATCH"), $"retro_board_config?board_id=eq.{boardId}");
        httpRequest.Headers.Add("Authorization", authorizationHeader.Replace("Bearer ", "").Trim());
        httpRequest.Headers.Add("apikey", _supabaseAnonKey);
        httpRequest.Headers.Add("Prefer", "return=minimal");
        httpRequest.Content = new StringContent(JsonSerializer.Serialize(payload), System.Text.Encoding.UTF8, "application/json");

        var response = await _postgrestClient.SendAsync(httpRequest, ct);

        if (response.StatusCode == HttpStatusCode.Unauthorized || response.StatusCode == HttpStatusCode.Forbidden)
        {
            throw new UnauthorizedAccessException("Not authorized to update retro board config.");
        }
        if (response.StatusCode == HttpStatusCode.NotFound)
        {
            throw new KeyNotFoundException($"Retro board config with board ID {boardId} not found.");
        }

        response.EnsureSuccessStatusCode();
    }

    private static RetroBoardConfigItem MapToRetroBoardConfigItem(RetroBoardConfigRecord record)
    {
        return new RetroBoardConfigItem
        {
            Id = record.Id,
            BoardId = record.Board_Id,
            AllowAnonymous = record.Allow_Anonymous,
            VotingEnabled = record.Voting_Enabled,
            MaxVotesPerUser = record.Max_Votes_Per_User,
            ShowAuthorNames = record.Show_Author_Names,
            RetroStagesEnabled = record.Retro_Stages_Enabled,
            EnforceStageReadiness = record.Enforce_Stage_Readiness,
            AllowSelfVotes = record.Allow_Self_Votes,
            VoteEmoji = record.Vote_Emoji,
            CreatedAt = record.Created_At,
            UpdatedAt = record.Updated_At
        };
    }

    private sealed class RetroBoardConfigRecord
    {
        public string Id { get; set; } = string.Empty;
        public string Board_Id { get; set; } = string.Empty;
        public bool? Allow_Anonymous { get; set; }
        public bool? Voting_Enabled { get; set; }
        public int? Max_Votes_Per_User { get; set; }
        public bool? Show_Author_Names { get; set; }
        public bool? Retro_Stages_Enabled { get; set; }
        public bool? Enforce_Stage_Readiness { get; set; }
        public bool? Allow_Self_Votes { get; set; }
        public string? Vote_Emoji { get; set; }
        public string Created_At { get; set; } = string.Empty;
        public string Updated_At { get; set; } = string.Empty;
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

    public async Task<List<RetroColumnItem>> GetRetroColumnsAsync(string boardId, string authorizationHeader, CancellationToken ct)
    {
        var url = $"retro_columns?board_id=eq.{boardId}&order=position.asc";

        var request = new HttpRequestMessage(HttpMethod.Get, url);
        request.Headers.Add("Authorization", authorizationHeader.Replace("Bearer ", "").Trim());
        request.Headers.Add("apikey", _supabaseAnonKey);

        var response = await _postgrestClient.SendAsync(request, ct);

        if (response.StatusCode == HttpStatusCode.Unauthorized || response.StatusCode == HttpStatusCode.Forbidden)
        {
            throw new UnauthorizedAccessException("Not authorized to access retro columns.");
        }

        response.EnsureSuccessStatusCode();

        var columns = await response.Content.ReadFromJsonAsync<List<RetroColumnRecord>>(cancellationToken: ct)
                     ?? new List<RetroColumnRecord>();

        return columns.Select(MapToRetroColumnItem).ToList();
    }

    public async Task<RetroColumnItem> CreateRetroColumnAsync(CreateRetroColumnRequest request, string authorizationHeader, CancellationToken ct)
    {
        var payload = new Dictionary<string, object?>
        {
            ["board_id"] = request.BoardId,
            ["title"] = request.Title,
            ["color"] = request.Color,
            ["position"] = request.Position
        };

        if (request.SortOrder.HasValue) payload["sort_order"] = request.SortOrder.Value;
        if (request.IsActionItems.HasValue) payload["is_action_items"] = request.IsActionItems.Value;

        var httpRequest = new HttpRequestMessage(HttpMethod.Post, "retro_columns");
        httpRequest.Headers.Add("Authorization", authorizationHeader.Replace("Bearer ", "").Trim());
        httpRequest.Headers.Add("apikey", _supabaseAnonKey);
        httpRequest.Headers.Add("Prefer", "return=representation");
        httpRequest.Content = new StringContent(JsonSerializer.Serialize(payload), System.Text.Encoding.UTF8, "application/json");

        var response = await _postgrestClient.SendAsync(httpRequest, ct);

        if (response.StatusCode == HttpStatusCode.Unauthorized || response.StatusCode == HttpStatusCode.Forbidden)
        {
            throw new UnauthorizedAccessException("Not authorized to create retro column.");
        }

        response.EnsureSuccessStatusCode();

        var newColumn = await response.Content.ReadFromJsonAsync<RetroColumnRecord>(cancellationToken: ct);
        if (newColumn == null)
        {
            throw new InvalidOperationException("Failed to deserialize new retro column from Supabase.");
        }

        return MapToRetroColumnItem(newColumn);
    }

    public async Task UpdateRetroColumnAsync(string columnId, UpdateRetroColumnRequest request, string authorizationHeader, CancellationToken ct)
    {
        var payload = new Dictionary<string, object?>();

        if (request.Title != null) payload["title"] = request.Title;
        if (request.Color != null) payload["color"] = request.Color;
        if (request.Position.HasValue) payload["position"] = request.Position.Value;
        if (request.SortOrder.HasValue) payload["sort_order"] = request.SortOrder.Value;
        if (request.IsActionItems.HasValue) payload["is_action_items"] = request.IsActionItems.Value;

        var httpRequest = new HttpRequestMessage(new HttpMethod("PATCH"), $"retro_columns?id=eq.{columnId}");
        httpRequest.Headers.Add("Authorization", authorizationHeader.Replace("Bearer ", "").Trim());
        httpRequest.Headers.Add("apikey", _supabaseAnonKey);
        httpRequest.Headers.Add("Prefer", "return=minimal");
        httpRequest.Content = new StringContent(JsonSerializer.Serialize(payload), System.Text.Encoding.UTF8, "application/json");

        var response = await _postgrestClient.SendAsync(httpRequest, ct);

        if (response.StatusCode == HttpStatusCode.Unauthorized || response.StatusCode == HttpStatusCode.Forbidden)
        {
            throw new UnauthorizedAccessException("Not authorized to update retro column.");
        }
        if (response.StatusCode == HttpStatusCode.NotFound)
        {
            throw new KeyNotFoundException($"Retro column with ID {columnId} not found.");
        }

        response.EnsureSuccessStatusCode();
    }

    public async Task DeleteRetroColumnAsync(string columnId, string authorizationHeader, CancellationToken ct)
    {
        var httpRequest = new HttpRequestMessage(HttpMethod.Delete, $"retro_columns?id=eq.{columnId}");
        httpRequest.Headers.Add("Authorization", authorizationHeader.Replace("Bearer ", "").Trim());
        httpRequest.Headers.Add("apikey", _supabaseAnonKey);
        httpRequest.Headers.Add("Prefer", "return=minimal");

        var response = await _postgrestClient.SendAsync(httpRequest, ct);

        if (response.StatusCode == HttpStatusCode.Unauthorized || response.StatusCode == HttpStatusCode.Forbidden)
        {
            throw new UnauthorizedAccessException("Not authorized to delete retro column.");
        }
        if (response.StatusCode == HttpStatusCode.NotFound)
        {
            throw new KeyNotFoundException($"Retro column with ID {columnId} not found.");
        }

        response.EnsureSuccessStatusCode();
    }

    public async Task UpdateRetroColumnsBatchAsync(List<UpdateRetroColumnRequest> requests, string authorizationHeader, CancellationToken ct)
    {
        // For batch updates, we'll need to update each column individually
        // since Supabase PostgREST doesn't support batch PATCH operations easily
        foreach (var request in requests)
        {
            // We need the column ID for each request, but the UpdateRetroColumnRequest doesn't have it
            // This is a design issue - we need to modify the request structure
            // For now, let's implement a simpler approach where we expect the column ID to be provided separately
            // Actually, looking at the frontend code, it seems like it sends individual updates with IDs
            // Let me implement this by expecting the column ID to be in the request or modify the approach
        }

        // For now, implement a simpler approach where we expect column IDs to be provided
        // This is a limitation of the current design - in practice, the frontend should send individual updates with IDs
        throw new NotImplementedException("Batch column updates require column IDs in the request");
    }

    private static RetroColumnItem MapToRetroColumnItem(RetroColumnRecord record)
    {
        return new RetroColumnItem
        {
            Id = record.Id,
            BoardId = record.Board_Id,
            Title = record.Title,
            Color = record.Color,
            Position = record.Position,
            SortOrder = record.Sort_Order,
            IsActionItems = record.Is_Action_Items,
            CreatedAt = record.Created_At
        };
    }

    private sealed class RetroColumnRecord
    {
        public string Id { get; set; } = string.Empty;
        public string? Board_Id { get; set; }
        public string Title { get; set; } = string.Empty;
        public string Color { get; set; } = string.Empty;
        public int Position { get; set; }
        public int? Sort_Order { get; set; }
        public bool? Is_Action_Items { get; set; }
        public string? Created_At { get; set; }
    }
    
    public async Task<List<RetroItemItem>> GetRetroItemsAsync(string boardId, string authorizationHeader, CancellationToken ct)
    {
        var url = $"retro_items?board_id=eq.{boardId}&select=*,profiles(avatar_url,full_name)&order=votes.desc";

        var request = new HttpRequestMessage(HttpMethod.Get, url);
        request.Headers.Add("Authorization", authorizationHeader.Replace("Bearer ", "").Trim());
        request.Headers.Add("apikey", _supabaseAnonKey);

        var response = await _postgrestClient.SendAsync(request, ct);

        if (response.StatusCode == HttpStatusCode.Unauthorized || response.StatusCode == HttpStatusCode.Forbidden)
        {
            throw new UnauthorizedAccessException("Not authorized to access retro items.");
        }

        response.EnsureSuccessStatusCode();

        var items = await response.Content.ReadFromJsonAsync<List<RetroItemRecord>>(cancellationToken: ct)
                     ?? new List<RetroItemRecord>();

        return items.Select(MapToRetroItemItem).ToList();
    }

    public async Task<RetroItemItem> CreateRetroItemAsync(CreateRetroItemRequest request, string authorizationHeader, CancellationToken ct)
    {
        var payload = new Dictionary<string, object?>
        {
            ["board_id"] = request.BoardId,
            ["text"] = request.Text,
            ["author"] = request.Author
        };

        if (request.ColumnId != null) payload["column_id"] = request.ColumnId;
        if (request.AuthorId != null) payload["author_id"] = request.AuthorId;
        if (request.SessionId != null) payload["session_id"] = request.SessionId;

        var httpRequest = new HttpRequestMessage(HttpMethod.Post, "retro_items");
        httpRequest.Headers.Add("Authorization", authorizationHeader.Replace("Bearer ", "").Trim());
        httpRequest.Headers.Add("apikey", _supabaseAnonKey);
        httpRequest.Headers.Add("Prefer", "return=representation");
        httpRequest.Content = new StringContent(JsonSerializer.Serialize(payload), System.Text.Encoding.UTF8, "application/json");

        var response = await _postgrestClient.SendAsync(httpRequest, ct);

        if (response.StatusCode == HttpStatusCode.Unauthorized || response.StatusCode == HttpStatusCode.Forbidden)
        {
            throw new UnauthorizedAccessException("Not authorized to create retro item.");
        }

        response.EnsureSuccessStatusCode();

        var newItem = await response.Content.ReadFromJsonAsync<RetroItemRecord>(cancellationToken: ct);
        if (newItem == null)
        {
            throw new InvalidOperationException("Failed to deserialize new retro item from Supabase.");
        }

        return MapToRetroItemItem(newItem);
    }

    public async Task UpdateRetroItemAsync(string itemId, UpdateRetroItemRequest request, string authorizationHeader, CancellationToken ct)
    {
        var payload = new Dictionary<string, object?>();

        if (request.Text != null) payload["text"] = request.Text;
        if (request.ColumnId != null) payload["column_id"] = request.ColumnId;

        var httpRequest = new HttpRequestMessage(new HttpMethod("PATCH"), $"retro_items?id=eq.{itemId}");
        httpRequest.Headers.Add("Authorization", authorizationHeader.Replace("Bearer ", "").Trim());
        httpRequest.Headers.Add("apikey", _supabaseAnonKey);
        httpRequest.Headers.Add("Prefer", "return=minimal");
        httpRequest.Content = new StringContent(JsonSerializer.Serialize(payload), System.Text.Encoding.UTF8, "application/json");

        var response = await _postgrestClient.SendAsync(httpRequest, ct);

        if (response.StatusCode == HttpStatusCode.Unauthorized || response.StatusCode == HttpStatusCode.Forbidden)
        {
            throw new UnauthorizedAccessException("Not authorized to update retro item.");
        }
        if (response.StatusCode == HttpStatusCode.NotFound)
        {
            throw new KeyNotFoundException($"Retro item with ID {itemId} not found.");
        }

        response.EnsureSuccessStatusCode();
    }

    public async Task DeleteRetroItemAsync(string itemId, string authorizationHeader, CancellationToken ct)
    {
        var httpRequest = new HttpRequestMessage(HttpMethod.Delete, $"retro_items?id=eq.{itemId}");
        httpRequest.Headers.Add("Authorization", authorizationHeader.Replace("Bearer ", "").Trim());
        httpRequest.Headers.Add("apikey", _supabaseAnonKey);
        httpRequest.Headers.Add("Prefer", "return=minimal");

        var response = await _postgrestClient.SendAsync(httpRequest, ct);

        if (response.StatusCode == HttpStatusCode.Unauthorized || response.StatusCode == HttpStatusCode.Forbidden)
        {
            throw new UnauthorizedAccessException("Not authorized to delete retro item.");
        }
        if (response.StatusCode == HttpStatusCode.NotFound)
        {
            throw new KeyNotFoundException($"Retro item with ID {itemId} not found.");
        }

        response.EnsureSuccessStatusCode();
    }

    private static RetroItemItem MapToRetroItemItem(RetroItemRecord record)
    {
        return new RetroItemItem
        {
            Id = record.Id,
            BoardId = record.Board_Id,
            ColumnId = record.Column_Id,
            Text = record.Text,
            Author = record.Author,
            AuthorId = record.Author_Id,
            Votes = record.Votes,
            SessionId = record.Session_Id,
            CreatedAt = record.Created_At,
            UpdatedAt = record.Updated_At
        };
    }

    private sealed class RetroItemRecord
    {
        public string Id { get; set; } = string.Empty;
        public string? Board_Id { get; set; }
        public string? Column_Id { get; set; }
        public string Text { get; set; } = string.Empty;
        public string Author { get; set; } = string.Empty;
        public string? Author_Id { get; set; }
        public int? Votes { get; set; }
        public string? Session_Id { get; set; }
        public string? Created_At { get; set; }
        public string? Updated_At { get; set; }
    }
}
