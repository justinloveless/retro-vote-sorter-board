using Retroscope.Application.DTOs.RetroComments;

namespace Retroscope.Application.Interfaces;

public partial interface ISupabaseGateway
{
    /// <summary>
    /// Fetches retro comments for a list of item IDs
    /// </summary>
    Task<List<RetroCommentItem>> GetRetroCommentsByItemIdsAsync(List<string> itemIds, string authorizationHeader, CancellationToken ct);

    /// <summary>
    /// Fetches retro comments for a single item ID
    /// </summary>
    Task<List<RetroCommentItem>> GetRetroCommentsByItemIdAsync(string itemId, string authorizationHeader, CancellationToken ct);

    /// <summary>
    /// Creates a new retro comment
    /// </summary>
    Task<RetroCommentItem> CreateRetroCommentAsync(CreateRetroCommentRequest request, string authorizationHeader, CancellationToken ct);

    /// <summary>
    /// Deletes a retro comment by ID
    /// </summary>
    Task DeleteRetroCommentAsync(string commentId, string authorizationHeader, CancellationToken ct);
}

