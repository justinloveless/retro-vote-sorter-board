using Retroscope.Application.DTOs.RetroBoard;

namespace Retroscope.Infrastructure.Postgres;

public partial class PostgresGateway
{
    public Task<RetroBoardAggregateResponse> GetRetroBoardAggregateAsync(string bearerToken, string boardId, string? correlationId = null, CancellationToken cancellationToken = default)
    {
        // TODO: Implement retro board aggregate query with RLS
        throw new NotImplementedException("Retro board aggregate not yet implemented in PostgresGateway");
    }
}

