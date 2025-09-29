

using Retroscope.Application.DTOs.RetroBoard;

namespace Retroscope.Application.Interfaces;

public partial interface ISupabaseGateway
{
    Task<RetroBoardTeamSummary> GetRetroBoardTeamSummaryAsync(string bearerToken, string roomId, string? correlationId = null, CancellationToken cancellationToken = default);
    Task<RetroBoardAggregateResponse> GetRetroBoardAsync(string bearerToken, string roomId, string? correlationId = null, CancellationToken cancellationToken = default);
    Task<RetroItem> CreateRetroItemAsync(string bearerToken, string boardId, string columnId, string text, string author, string? sessionId, string? correlationId = null, CancellationToken cancellationToken = default);
    Task<bool> UpdateRetroItemAsync(string bearerToken, string itemId, string text, string? correlationId = null, CancellationToken cancellationToken = default);
    Task<bool> DeleteRetroItemAsync(string bearerToken, string itemId, string? correlationId = null, CancellationToken cancellationToken = default);
    Task<bool> AddRetroVoteAsync(string bearerToken, string boardId, string itemId, string? userId, string? sessionId, string? correlationId = null, CancellationToken cancellationToken = default);
    Task<bool> RemoveRetroVoteAsync(string bearerToken, string boardId, string itemId, string? userId, string? sessionId, string? correlationId = null, CancellationToken cancellationToken = default);
    Task<RetroComment> AddRetroCommentAsync(string bearerToken, string itemId, string text, string author, string? authorId, string? sessionId, string? correlationId = null, CancellationToken cancellationToken = default);
    Task<bool> DeleteRetroCommentAsync(string bearerToken, string commentId, string? correlationId = null, CancellationToken cancellationToken = default);

}