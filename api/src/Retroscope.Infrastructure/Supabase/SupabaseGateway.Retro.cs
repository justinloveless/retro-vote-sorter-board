using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Retroscope.Application.DTOs.RetroBoard;

namespace Retroscope.Infrastructure.Supabase;

public partial class SupabaseGateway
{
    public async Task<RetroBoardTeamSummary> GetRetroBoardTeamSummaryAsync(string bearerToken, string roomId, string? correlationId = null, CancellationToken cancellationToken = default)
    {
        // 1) Get board by room_id
        var boardReq = new HttpRequestMessage(HttpMethod.Get, $"retro_boards?room_id=eq.{roomId}");
        boardReq.Headers.Authorization = AuthenticationHeaderValue.Parse(bearerToken);
        if (!string.IsNullOrEmpty(_supabaseAnonKey)) boardReq.Headers.TryAddWithoutValidation("apikey", _supabaseAnonKey);
        if (!string.IsNullOrEmpty(correlationId)) boardReq.Headers.Add("X-Correlation-Id", correlationId);
        var boardResp = await _postgrestClient.SendAsync(boardReq, cancellationToken);
        if (!boardResp.IsSuccessStatusCode)
        {
            throw new HttpException(boardResp.StatusCode, $"Supabase request failed with status {boardResp.StatusCode}");
        }
        var boardJson = await boardResp.Content.ReadAsStringAsync(cancellationToken);
        var boardRows = JsonSerializer.Deserialize<List<JsonElement>>(boardJson, new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ??
                        [];
        var row = boardRows.FirstOrDefault();
        if (row.ValueKind == JsonValueKind.Undefined)
        {
            return new RetroBoardTeamSummary();
        }
        var boardId = row.TryGetProperty("id", out var bid) ? (bid.GetString() ?? string.Empty) : string.Empty;
        var teamId = row.TryGetProperty("team_id", out var tid) ? tid.GetString() : null;
        var summary = new RetroBoardTeamSummary
        {
            Board = new RetroBoardItem
            {
                Id = boardId,
                RoomId = row.TryGetProperty("room_id", out var rid) ? rid.GetString() ?? string.Empty : string.Empty,
                TeamId = teamId,
                Title = row.TryGetProperty("title", out var ttl) ? ttl.GetString() ?? string.Empty : string.Empty,
                RetroStage = row.TryGetProperty("retro_stage", out var rs) ? rs.GetString() : null,
                CreatedAt = row.TryGetProperty("created_at", out var ca) && ca.ValueKind == JsonValueKind.String ? DateTime.Parse(ca.GetString()!) : null
            }
        };

        // 2) If teamId, get team basic and members
        if (!string.IsNullOrEmpty(teamId))
        {
            var teamReq = new HttpRequestMessage(HttpMethod.Get, $"teams?id=eq.{teamId}");
            teamReq.Headers.Authorization = AuthenticationHeaderValue.Parse(bearerToken);
            if (!string.IsNullOrEmpty(_supabaseAnonKey)) teamReq.Headers.TryAddWithoutValidation("apikey", _supabaseAnonKey);
            if (!string.IsNullOrEmpty(correlationId)) teamReq.Headers.Add("X-Correlation-Id", correlationId);
            var teamResp = await _postgrestClient.SendAsync(teamReq, cancellationToken);
            if (teamResp.IsSuccessStatusCode)
            {
                var teamJson = await teamResp.Content.ReadAsStringAsync(cancellationToken);
                var teamRows = JsonSerializer.Deserialize<List<JsonElement>>(teamJson, new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ??
                               [];
                var trow = teamRows.FirstOrDefault();
                if (trow.ValueKind != JsonValueKind.Undefined)
                {
                    var team = new RetroBoardTeam
                    {
                        Id = trow.TryGetProperty("id", out var id) ? id.GetString() ?? string.Empty : string.Empty,
                        Name = trow.TryGetProperty("name", out var nm) ? nm.GetString() ?? string.Empty : string.Empty
                    };
                    // members
                    var membersReq = new HttpRequestMessage(HttpMethod.Get, $"team_members?select=user_id,role&team_id=eq.{teamId}");
                    membersReq.Headers.Authorization = AuthenticationHeaderValue.Parse(bearerToken);
                    if (!string.IsNullOrEmpty(_supabaseAnonKey)) membersReq.Headers.TryAddWithoutValidation("apikey", _supabaseAnonKey);
                    if (!string.IsNullOrEmpty(correlationId)) membersReq.Headers.Add("X-Correlation-Id", correlationId);
                    var membersResp = await _postgrestClient.SendAsync(membersReq, cancellationToken);
                    if (membersResp.IsSuccessStatusCode)
                    {
                        var memJson = await membersResp.Content.ReadAsStringAsync(cancellationToken);
                        var memRows = JsonSerializer.Deserialize<List<JsonElement>>(memJson, new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ??
                                      [];
                        team.Members = memRows.Select(m => new RetroBoardTeamMember
                        {
                            UserId = m.TryGetProperty("user_id", out var uid) ? uid.GetString() ?? string.Empty : string.Empty,
                            Role = m.TryGetProperty("role", out var rl) ? rl.GetString() ?? string.Empty : string.Empty
                        }).ToList();
                    }
                    summary.Team = team;
                }
            }
        }

        return summary;
    }
    public async Task<RetroBoardAggregateResponse> GetRetroBoardAsync(string bearerToken, string roomId, string? correlationId = null, CancellationToken cancellationToken = default)
    {
        try
        {
            _logger.LogInformation("Fetching retro board aggregate for room {RoomId}", roomId);

            var boardReq = new HttpRequestMessage(HttpMethod.Get, $"retro_boards?room_id=eq.{roomId}");
            boardReq.Headers.Authorization = AuthenticationHeaderValue.Parse(bearerToken);
            if (!string.IsNullOrEmpty(_supabaseAnonKey)) boardReq.Headers.TryAddWithoutValidation("apikey", _supabaseAnonKey);
            if (!string.IsNullOrEmpty(correlationId)) boardReq.Headers.Add("X-Correlation-Id", correlationId);

            var boardResp = await _postgrestClient.SendAsync(boardReq, cancellationToken);
            if (!boardResp.IsSuccessStatusCode)
            {
                if (boardResp.StatusCode == HttpStatusCode.NotFound)
                {
                    return new RetroBoardAggregateResponse();
                }
                throw new HttpException(boardResp.StatusCode, $"Supabase request failed with status {boardResp.StatusCode}");
            }

            var boardJson = await boardResp.Content.ReadAsStringAsync(cancellationToken);
            var boardRows = JsonSerializer.Deserialize<List<JsonElement>>(boardJson, new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ??
                            [];
            var boardRow = boardRows.FirstOrDefault();
            if (boardRow.ValueKind == JsonValueKind.Undefined)
            {
                return new RetroBoardAggregateResponse();
            }

            var boardId = boardRow.TryGetProperty("id", out var bid) ? (bid.GetString() ?? string.Empty) : string.Empty;
            var board = new RetroBoardItem
            {
                Id = boardId,
                RoomId = boardRow.TryGetProperty("room_id", out var rid) ? rid.GetString() ?? string.Empty : string.Empty,
                TeamId = boardRow.TryGetProperty("team_id", out var tid) ? tid.GetString() : null,
                Title = boardRow.TryGetProperty("title", out var ttl) ? ttl.GetString() ?? string.Empty : string.Empty,
                RetroStage = boardRow.TryGetProperty("retro_stage", out var rs) ? rs.GetString() : null,
                CreatedAt = boardRow.TryGetProperty("created_at", out var ca) && ca.ValueKind == JsonValueKind.String ? DateTime.Parse(ca.GetString()!) : null
            };

            var aggregate = new RetroBoardAggregateResponse { Board = board };

            var cfgReq = new HttpRequestMessage(HttpMethod.Get, $"retro_board_config?board_id=eq.{boardId}");
            cfgReq.Headers.Authorization = AuthenticationHeaderValue.Parse(bearerToken);
            if (!string.IsNullOrEmpty(_supabaseAnonKey)) cfgReq.Headers.TryAddWithoutValidation("apikey", _supabaseAnonKey);
            if (!string.IsNullOrEmpty(correlationId)) cfgReq.Headers.Add("X-Correlation-Id", correlationId);
            var cfgResp = await _postgrestClient.SendAsync(cfgReq, cancellationToken);
            if (cfgResp.IsSuccessStatusCode)
            {
                var cfgJson = await cfgResp.Content.ReadAsStringAsync(cancellationToken);
                var cfgRows = JsonSerializer.Deserialize<List<JsonElement>>(cfgJson, new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ??
                              [];
                aggregate.Config = cfgRows.FirstOrDefault();
            }

            var colReq = new HttpRequestMessage(HttpMethod.Get, $"retro_columns?board_id=eq.{boardId}&order=position.asc");
            colReq.Headers.Authorization = AuthenticationHeaderValue.Parse(bearerToken);
            if (!string.IsNullOrEmpty(_supabaseAnonKey)) colReq.Headers.TryAddWithoutValidation("apikey", _supabaseAnonKey);
            if (!string.IsNullOrEmpty(correlationId)) colReq.Headers.Add("X-Correlation-Id", correlationId);
            var colResp = await _postgrestClient.SendAsync(colReq, cancellationToken);
            if (colResp.IsSuccessStatusCode)
            {
                var colJson = await colResp.Content.ReadAsStringAsync(cancellationToken);
                var colRows = JsonSerializer.Deserialize<List<JsonElement>>(colJson, new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ??
                              [];
                aggregate.Columns = colRows.Select(r => new RetroColumnItem
                {
                    Id = r.TryGetProperty("id", out var id) ? id.GetString() ?? string.Empty : string.Empty,
                    BoardId = boardId,
                    Title = r.TryGetProperty("title", out var t) ? t.GetString() ?? string.Empty : string.Empty,
                    Position = r.TryGetProperty("position", out var p) && p.ValueKind == JsonValueKind.Number ? p.GetInt32() : null,
                    SortOrder = r.TryGetProperty("sort_order", out var so) && so.ValueKind == JsonValueKind.Number ? so.GetInt32() : null,
                    IsActionItems = r.TryGetProperty("is_action_items", out var ai) && ai.ValueKind == JsonValueKind.True ? true : (ai.ValueKind == JsonValueKind.False ? false : null)
                }).ToList();
            }

            var itemsReq = new HttpRequestMessage(HttpMethod.Get, $"retro_items?board_id=eq.{boardId}");
            itemsReq.Headers.Authorization = AuthenticationHeaderValue.Parse(bearerToken);
            if (!string.IsNullOrEmpty(_supabaseAnonKey)) itemsReq.Headers.TryAddWithoutValidation("apikey", _supabaseAnonKey);
            if (!string.IsNullOrEmpty(correlationId)) itemsReq.Headers.Add("X-Correlation-Id", correlationId);
            var itemsResp = await _postgrestClient.SendAsync(itemsReq, cancellationToken);
            var items = new List<RetroItem>();
            if (itemsResp.IsSuccessStatusCode)
            {
                var itemsJson = await itemsResp.Content.ReadAsStringAsync(cancellationToken);
                var itemRows = JsonSerializer.Deserialize<List<JsonElement>>(itemsJson, new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ??
                               [];
                items = itemRows.Select(r => new RetroItem
                {
                    Id = r.TryGetProperty("id", out var id) ? id.GetString() ?? string.Empty : string.Empty,
                    BoardId = boardId,
                    ColumnId = r.TryGetProperty("column_id", out var cid) ? cid.GetString() ?? string.Empty : string.Empty,
                    Text = r.TryGetProperty("text", out var tx) ? tx.GetString() ?? string.Empty : string.Empty,
                    Author = r.TryGetProperty("author", out var au) ? au.GetString() ?? string.Empty : string.Empty,
                    AuthorId = r.TryGetProperty("author_id", out var aid) ? aid.GetString() : null,
                    Votes = r.TryGetProperty("votes", out var vt) && vt.ValueKind == JsonValueKind.Number ? vt.GetInt32() : 0,
                    CreatedAt = r.TryGetProperty("created_at", out var cat) && cat.ValueKind == JsonValueKind.String ? DateTime.Parse(cat.GetString()!) : null,
                    SessionId = r.TryGetProperty("session_id", out var sid) ? sid.GetString() : null
                }).ToList();
            }
            aggregate.Items = items;

            if (items.Count > 0)
            {
                var ids = string.Join(',', items.Select(i => i.Id));
                var commentsReq = new HttpRequestMessage(HttpMethod.Get, $"retro_comments?item_id=in.({ids})&order=created_at.asc");
                commentsReq.Headers.Authorization = AuthenticationHeaderValue.Parse(bearerToken);
                if (!string.IsNullOrEmpty(_supabaseAnonKey)) commentsReq.Headers.TryAddWithoutValidation("apikey", _supabaseAnonKey);
                if (!string.IsNullOrEmpty(correlationId)) commentsReq.Headers.Add("X-Correlation-Id", correlationId);
                var commentsResp = await _postgrestClient.SendAsync(commentsReq, cancellationToken);
                if (commentsResp.IsSuccessStatusCode)
                {
                    var commentsJson = await commentsResp.Content.ReadAsStringAsync(cancellationToken);
                    var commentRows = JsonSerializer.Deserialize<List<JsonElement>>(commentsJson, new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ??
                                      [];
                    aggregate.Comments = commentRows.Select(r => new RetroComment
                    {
                        Id = r.TryGetProperty("id", out var id) ? id.GetString() ?? string.Empty : string.Empty,
                        ItemId = r.TryGetProperty("item_id", out var iid) ? iid.GetString() ?? string.Empty : string.Empty,
                        Text = r.TryGetProperty("text", out var tx) ? tx.GetString() ?? string.Empty : string.Empty,
                        Author = r.TryGetProperty("author", out var au) ? au.GetString() ?? string.Empty : string.Empty,
                        AuthorId = r.TryGetProperty("author_id", out var aid) ? aid.GetString() : null,
                        CreatedAt = r.TryGetProperty("created_at", out var cat) && cat.ValueKind == JsonValueKind.String ? DateTime.Parse(cat.GetString()!) : null
                    }).ToList();
                }
            }

            var votesReq = new HttpRequestMessage(HttpMethod.Get, $"retro_votes?board_id=eq.{boardId}&select=item_id");
            votesReq.Headers.Authorization = AuthenticationHeaderValue.Parse(bearerToken);
            if (!string.IsNullOrEmpty(_supabaseAnonKey)) votesReq.Headers.TryAddWithoutValidation("apikey", _supabaseAnonKey);
            if (!string.IsNullOrEmpty(correlationId)) votesReq.Headers.Add("X-Correlation-Id", correlationId);
            var votesResp = await _postgrestClient.SendAsync(votesReq, cancellationToken);
            if (votesResp.IsSuccessStatusCode)
            {
                var votesJson = await votesResp.Content.ReadAsStringAsync(cancellationToken);
                var voteRows = JsonSerializer.Deserialize<List<JsonElement>>(votesJson, new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ??
                               [];
                var voteCounts = voteRows
                    .Where(v => v.TryGetProperty("item_id", out _))
                    .Select(v => v.GetProperty("item_id").GetString() ?? string.Empty)
                    .Where(id => !string.IsNullOrEmpty(id))
                    .GroupBy(id => id)
                    .ToDictionary(g => g.Key, g => g.Count());
                foreach (var item in aggregate.Items)
                {
                    if (voteCounts.TryGetValue(item.Id, out var c)) item.Votes = c;
                }
            }

            var userId = ExtractUserIdFromToken(bearerToken);
            aggregate.UserVotes = [];
            if (!string.IsNullOrEmpty(userId))
            {
                var myVotesReq = new HttpRequestMessage(HttpMethod.Get, $"retro_votes?board_id=eq.{boardId}&user_id=eq.{userId}&select=item_id");
                myVotesReq.Headers.Authorization = AuthenticationHeaderValue.Parse(bearerToken);
                if (!string.IsNullOrEmpty(_supabaseAnonKey)) myVotesReq.Headers.TryAddWithoutValidation("apikey", _supabaseAnonKey);
                if (!string.IsNullOrEmpty(correlationId)) myVotesReq.Headers.Add("X-Correlation-Id", correlationId);
                var myVotesResp = await _postgrestClient.SendAsync(myVotesReq, cancellationToken);
                if (myVotesResp.IsSuccessStatusCode)
                {
                    var myVotesJson = await myVotesResp.Content.ReadAsStringAsync(cancellationToken);
                    var myVoteRows = JsonSerializer.Deserialize<List<JsonElement>>(myVotesJson, new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ??
                                     [];
                    aggregate.UserVotes = myVoteRows
                        .Where(v => v.TryGetProperty("item_id", out _))
                        .Select(v => v.GetProperty("item_id").GetString() ?? string.Empty)
                        .Where(id => !string.IsNullOrEmpty(id))
                        .ToList();
                }
            }

            var authorIds = aggregate.Items.Select(i => i.AuthorId).Where(id => !string.IsNullOrEmpty(id)).Cast<string>().Distinct().ToList();
            if (authorIds.Count > 0)
            {
                var profiles = await FetchProfilesAsync(authorIds, bearerToken, correlationId, cancellationToken);
                foreach (var item in aggregate.Items)
                {
                    if (!string.IsNullOrEmpty(item.AuthorId) && profiles.TryGetValue(item.AuthorId, out var p))
                    {
                        item.DisplayName = p.fullName ?? item.Author;
                    }
                }
            }

            return aggregate;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching retro board aggregate for room {RoomId}", roomId);
            throw;
        }
    }

    public async Task<RetroItem> CreateRetroItemAsync(string bearerToken, string boardId, string columnId, string text, string author, string? sessionId, string? correlationId = null, CancellationToken cancellationToken = default)
    {
        try
        {
            _logger.LogInformation("Creating retro item on board {BoardId} in column {ColumnId}", boardId, columnId);
            var authorId = ExtractUserIdFromToken(bearerToken);
            var body = JsonSerializer.Serialize(new { board_id = boardId, column_id = columnId, text, author, author_id = authorId, session_id = sessionId });
            var content = new StringContent(body, Encoding.UTF8, "application/json");
            var req = new HttpRequestMessage(HttpMethod.Post, "retro_items") { Content = content };
            req.Headers.Authorization = AuthenticationHeaderValue.Parse(bearerToken);
            if (!string.IsNullOrEmpty(_supabaseAnonKey)) req.Headers.TryAddWithoutValidation("apikey", _supabaseAnonKey);
            if (!string.IsNullOrEmpty(correlationId)) req.Headers.Add("X-Correlation-Id", correlationId);

            var resp = await _postgrestClient.SendAsync(req, cancellationToken);
            if (!resp.IsSuccessStatusCode) throw new HttpException(resp.StatusCode, $"Supabase request failed with status {resp.StatusCode}");
            var json = await resp.Content.ReadAsStringAsync(cancellationToken);
            var rows = JsonSerializer.Deserialize<List<JsonElement>>(json, new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ??
                       [];
            var r = rows.First();
            return new RetroItem
            {
                Id = r.TryGetProperty("id", out var id) ? id.GetString() ?? string.Empty : string.Empty,
                BoardId = boardId,
                ColumnId = columnId,
                Text = text,
                Author = author,
                AuthorId = authorId,
                Votes = 0,
                CreatedAt = r.TryGetProperty("created_at", out var ca) && ca.ValueKind == JsonValueKind.String ? DateTime.Parse(ca.GetString()!) : null,
                SessionId = sessionId
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating retro item on board {BoardId}", boardId);
            throw;
        }
    }

    public async Task<bool> UpdateRetroItemAsync(string bearerToken, string itemId, string text, string? correlationId = null, CancellationToken cancellationToken = default)
    {
        try
        {
            var body = JsonSerializer.Serialize(new { text });
            var content = new StringContent(body, Encoding.UTF8, "application/json");
            var req = new HttpRequestMessage(HttpMethod.Patch, $"retro_items?id=eq.{itemId}") { Content = content };
            req.Headers.Authorization = AuthenticationHeaderValue.Parse(bearerToken);
            if (!string.IsNullOrEmpty(_supabaseAnonKey)) req.Headers.TryAddWithoutValidation("apikey", _supabaseAnonKey);
            if (!string.IsNullOrEmpty(correlationId)) req.Headers.Add("X-Correlation-Id", correlationId);

            var resp = await _postgrestClient.SendAsync(req, cancellationToken);
            return resp.IsSuccessStatusCode;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating retro item {ItemId}", itemId);
            throw;
        }
    }

    public async Task<bool> DeleteRetroItemAsync(string bearerToken, string itemId, string? correlationId = null, CancellationToken cancellationToken = default)
    {
        try
        {
            var req = new HttpRequestMessage(HttpMethod.Delete, $"retro_items?id=eq.{itemId}");
            req.Headers.Authorization = AuthenticationHeaderValue.Parse(bearerToken);
            if (!string.IsNullOrEmpty(_supabaseAnonKey)) req.Headers.TryAddWithoutValidation("apikey", _supabaseAnonKey);
            if (!string.IsNullOrEmpty(correlationId)) req.Headers.Add("X-Correlation-Id", correlationId);

            var resp = await _postgrestClient.SendAsync(req, cancellationToken);
            return resp.IsSuccessStatusCode;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting retro item {ItemId}", itemId);
            throw;
        }
    }

    public async Task<bool> AddRetroVoteAsync(string bearerToken, string boardId, string itemId, string? userId, string? sessionId, string? correlationId = null, CancellationToken cancellationToken = default)
    {
        try
        {
            userId ??= ExtractUserIdFromToken(bearerToken);
            var body = JsonSerializer.Serialize(new { board_id = boardId, item_id = itemId, user_id = userId, session_id = sessionId });
            var content = new StringContent(body, Encoding.UTF8, "application/json");
            var req = new HttpRequestMessage(HttpMethod.Post, "retro_votes") { Content = content };
            req.Headers.Authorization = AuthenticationHeaderValue.Parse(bearerToken);
            if (!string.IsNullOrEmpty(_supabaseAnonKey)) req.Headers.TryAddWithoutValidation("apikey", _supabaseAnonKey);
            if (!string.IsNullOrEmpty(correlationId)) req.Headers.Add("X-Correlation-Id", correlationId);

            var resp = await _postgrestClient.SendAsync(req, cancellationToken);
            return resp.IsSuccessStatusCode;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error adding retro vote for item {ItemId}", itemId);
            throw;
        }
    }

    public async Task<bool> RemoveRetroVoteAsync(string bearerToken, string boardId, string itemId, string? userId, string? sessionId, string? correlationId = null, CancellationToken cancellationToken = default)
    {
        try
        {
            userId ??= ExtractUserIdFromToken(bearerToken);
            var query = new StringBuilder($"retro_votes?board_id=eq.{boardId}&item_id=eq.{itemId}");
            if (!string.IsNullOrEmpty(userId)) query.Append($"&user_id=eq.{userId}");
            if (!string.IsNullOrEmpty(sessionId)) query.Append($"&session_id=eq.{sessionId}");
            var req = new HttpRequestMessage(HttpMethod.Delete, query.ToString());
            req.Headers.Authorization = AuthenticationHeaderValue.Parse(bearerToken);
            if (!string.IsNullOrEmpty(_supabaseAnonKey)) req.Headers.TryAddWithoutValidation("apikey", _supabaseAnonKey);
            if (!string.IsNullOrEmpty(correlationId)) req.Headers.Add("X-Correlation-Id", correlationId);

            var resp = await _postgrestClient.SendAsync(req, cancellationToken);
            return resp.IsSuccessStatusCode;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error removing retro vote for item {ItemId}", itemId);
            throw;
        }
    }

    public async Task<RetroComment> AddRetroCommentAsync(string bearerToken, string itemId, string text, string author, string? authorId, string? sessionId, string? correlationId = null, CancellationToken cancellationToken = default)
    {
        try
        {
            _logger.LogInformation("Adding comment to item {ItemId}", itemId);
            authorId ??= ExtractUserIdFromToken(bearerToken);
            var body = JsonSerializer.Serialize(new { item_id = itemId, text, author, author_id = authorId, session_id = sessionId });
            var content = new StringContent(body, Encoding.UTF8, "application/json");
            var req = new HttpRequestMessage(HttpMethod.Post, "retro_comments") { Content = content };
            req.Headers.Authorization = AuthenticationHeaderValue.Parse(bearerToken);
            if (!string.IsNullOrEmpty(_supabaseAnonKey)) req.Headers.TryAddWithoutValidation("apikey", _supabaseAnonKey);
            if (!string.IsNullOrEmpty(correlationId)) req.Headers.Add("X-Correlation-Id", correlationId);

            var resp = await _postgrestClient.SendAsync(req, cancellationToken);
            if (!resp.IsSuccessStatusCode) throw new HttpException(resp.StatusCode, $"Supabase request failed with status {resp.StatusCode}");
            var json = await resp.Content.ReadAsStringAsync(cancellationToken);
            var rows = JsonSerializer.Deserialize<List<JsonElement>>(json, new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ??
                       [];
            var r = rows.First();
            return new RetroComment
            {
                Id = r.TryGetProperty("id", out var id) ? id.GetString() ?? string.Empty : string.Empty,
                ItemId = itemId,
                Text = text,
                Author = author,
                AuthorId = authorId,
                CreatedAt = r.TryGetProperty("created_at", out var ca) && ca.ValueKind == JsonValueKind.String ? DateTime.Parse(ca.GetString()!) : null
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error adding comment to item {ItemId}", itemId);
            throw;
        }
    }

    public async Task<bool> DeleteRetroCommentAsync(string bearerToken, string commentId, string? correlationId = null, CancellationToken cancellationToken = default)
    {
        try
        {
            var req = new HttpRequestMessage(HttpMethod.Delete, $"retro_comments?id=eq.{commentId}");
            req.Headers.Authorization = AuthenticationHeaderValue.Parse(bearerToken);
            if (!string.IsNullOrEmpty(_supabaseAnonKey)) req.Headers.TryAddWithoutValidation("apikey", _supabaseAnonKey);
            if (!string.IsNullOrEmpty(correlationId)) req.Headers.Add("X-Correlation-Id", correlationId);

            var resp = await _postgrestClient.SendAsync(req, cancellationToken);
            return resp.IsSuccessStatusCode;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting comment {CommentId}", commentId);
            throw;
        }
    }
}


