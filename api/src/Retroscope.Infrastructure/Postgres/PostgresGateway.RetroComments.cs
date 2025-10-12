using Retroscope.Application.DTOs.RetroComments;

namespace Retroscope.Infrastructure.Postgres;

public partial class PostgresGateway
{
    public Task<RetroCommentsResponse> GetRetroCommentsAsync(string bearerToken, string itemId, string? correlationId = null, CancellationToken cancellationToken = default)
    {
        // TODO: Implement retro comments query with RLS
        throw new NotImplementedException("Retro comments query not yet implemented in PostgresGateway");
    }

    public Task<RetroCommentItem> CreateRetroCommentAsync(string bearerToken, CreateRetroCommentRequest request, string? correlationId = null, CancellationToken cancellationToken = default)
    {
        // TODO: Implement create retro comment with RLS
        throw new NotImplementedException("Create retro comment not yet implemented in PostgresGateway");
    }
}

