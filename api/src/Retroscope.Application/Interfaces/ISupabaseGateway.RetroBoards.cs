using Retroscope.Application.DTOs.RetroBoards;
using Retroscope.Application.DTOs.RetroBoardConfig;

namespace Retroscope.Application.Interfaces;

public partial interface ISupabaseGateway
{
    /// <summary>
    /// Gets retro boards for a specific team
    /// </summary>
    Task<List<RetroBoardItem>> GetRetroBoardsAsync(string teamId, bool includeDeleted, string authorizationHeader, CancellationToken ct);

    /// <summary>
    /// Gets a retro board by room ID
    /// </summary>
    Task<RetroBoardItem?> GetRetroBoardByRoomIdAsync(string roomId, string authorizationHeader, CancellationToken ct);

    /// <summary>
    /// Creates a new retro board
    /// </summary>
    Task<RetroBoardItem> CreateRetroBoardAsync(CreateRetroBoardRequest request, string authorizationHeader, CancellationToken ct);

    /// <summary>
    /// Updates a retro board by ID
    /// </summary>
    Task UpdateRetroBoardAsync(string boardId, UpdateRetroBoardRequest request, string authorizationHeader, CancellationToken ct);

    /// <summary>
    /// Deletes a retro board by ID
    /// </summary>
    Task DeleteRetroBoardAsync(string boardId, string authorizationHeader, CancellationToken ct);

    /// <summary>
    /// Gets a retro board summary by room ID, including team and member information
    /// </summary>
    Task<RetroBoardSummaryResponse?> GetRetroBoardSummaryAsync(string roomId, string authorizationHeader, CancellationToken ct);

    /// <summary>
    /// Gets board titles for a list of board IDs
    /// </summary>
    Task<List<BoardTitleItem>> GetRetroBoardTitlesByIdsAsync(List<string> boardIds, string authorizationHeader, CancellationToken ct);

    /// <summary>
    /// Gets retro board config for a specific board
    /// </summary>
    Task<RetroBoardConfigItem?> GetRetroBoardConfigAsync(string boardId, string authorizationHeader, CancellationToken ct);

    /// <summary>
    /// Creates a new retro board config
    /// </summary>
    Task<RetroBoardConfigItem> CreateRetroBoardConfigAsync(CreateRetroBoardConfigRequest request, string authorizationHeader, CancellationToken ct);

    /// <summary>
    /// Updates retro board config for a specific board
    /// </summary>
    Task UpdateRetroBoardConfigAsync(string boardId, UpdateRetroBoardConfigRequest request, string authorizationHeader, CancellationToken ct);
}
