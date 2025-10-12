using Retroscope.Application.DTOs.RetroBoards;

namespace Retroscope.Infrastructure.Postgres;

public partial class PostgresGateway
{
    public Task<RetroBoardsResponse> GetRetroBoardsAsync(string bearerToken, string teamId, string? correlationId = null, CancellationToken cancellationToken = default)
    {
        // TODO: Implement retro boards query with RLS
        throw new NotImplementedException("Retro boards query not yet implemented in PostgresGateway");
    }

    public Task<RetroBoardItem> GetRetroBoardAsync(string bearerToken, string boardId, string? correlationId = null, CancellationToken cancellationToken = default)
    {
        // TODO: Implement retro board query with RLS
        throw new NotImplementedException("Retro board query not yet implemented in PostgresGateway");
    }

    public Task<RetroBoardItem> CreateRetroBoardAsync(string bearerToken, CreateRetroBoardRequest request, string? correlationId = null, CancellationToken cancellationToken = default)
    {
        // TODO: Implement create retro board with RLS
        throw new NotImplementedException("Create retro board not yet implemented in PostgresGateway");
    }

    public Task<RetroBoardItem> UpdateRetroBoardAsync(string bearerToken, string boardId, UpdateRetroBoardRequest request, string? correlationId = null, CancellationToken cancellationToken = default)
    {
        // TODO: Implement update retro board with RLS
        throw new NotImplementedException("Update retro board not yet implemented in PostgresGateway");
    }

    public Task DeleteRetroBoardAsync(string bearerToken, string boardId, string? correlationId = null, CancellationToken cancellationToken = default)
    {
        // TODO: Implement delete retro board with RLS
        throw new NotImplementedException("Delete retro board not yet implemented in PostgresGateway");
    }

    public Task<BoardTitlesResponse> GetBoardTitlesAsync(string bearerToken, string teamId, string? correlationId = null, CancellationToken cancellationToken = default)
    {
        // TODO: Implement board titles query with RLS
        throw new NotImplementedException("Board titles query not yet implemented in PostgresGateway");
    }

    public Task<RetroBoardSummaryResponse> GetRetroBoardSummaryAsync(string bearerToken, string boardId, string? correlationId = null, CancellationToken cancellationToken = default)
    {
        // TODO: Implement retro board summary with RLS
        throw new NotImplementedException("Retro board summary not yet implemented in PostgresGateway");
    }
}

