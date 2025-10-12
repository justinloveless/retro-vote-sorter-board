using Retroscope.Application.DTOs.RetroBoards;

namespace Retroscope.Application.Interfaces;

public partial interface IPostgresGateway
{
    Task<RetroBoardsResponse> GetRetroBoardsAsync(string bearerToken, string teamId, string? correlationId = null, CancellationToken cancellationToken = default);
    Task<RetroBoardItem> GetRetroBoardAsync(string bearerToken, string boardId, string? correlationId = null, CancellationToken cancellationToken = default);
    Task<RetroBoardItem> CreateRetroBoardAsync(string bearerToken, CreateRetroBoardRequest request, string? correlationId = null, CancellationToken cancellationToken = default);
    Task<RetroBoardItem> UpdateRetroBoardAsync(string bearerToken, string boardId, UpdateRetroBoardRequest request, string? correlationId = null, CancellationToken cancellationToken = default);
    Task DeleteRetroBoardAsync(string bearerToken, string boardId, string? correlationId = null, CancellationToken cancellationToken = default);
    Task<BoardTitlesResponse> GetBoardTitlesAsync(string bearerToken, string teamId, string? correlationId = null, CancellationToken cancellationToken = default);
    Task<RetroBoardSummaryResponse> GetRetroBoardSummaryAsync(string bearerToken, string boardId, string? correlationId = null, CancellationToken cancellationToken = default);
}

