using Retroscope.Application.DTOs.RetroComments;

namespace Retroscope.Application.Interfaces;

public partial interface IPostgresGateway
{
    Task<RetroCommentsResponse> GetRetroCommentsAsync(string bearerToken, string itemId, string? correlationId = null, CancellationToken cancellationToken = default);
    Task<RetroCommentItem> CreateRetroCommentAsync(string bearerToken, CreateRetroCommentRequest request, string? correlationId = null, CancellationToken cancellationToken = default);
}

