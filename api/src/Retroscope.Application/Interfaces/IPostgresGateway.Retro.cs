using Retroscope.Application.DTOs.RetroBoard;

namespace Retroscope.Application.Interfaces;

public partial interface IPostgresGateway
{
    Task<RetroBoardAggregateResponse> GetRetroBoardAggregateAsync(string bearerToken, string boardId, string? correlationId = null, CancellationToken cancellationToken = default);
}

