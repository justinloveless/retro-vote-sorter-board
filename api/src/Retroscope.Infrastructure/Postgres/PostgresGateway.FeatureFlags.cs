using Retroscope.Application.DTOs.FeatureFlags;

namespace Retroscope.Infrastructure.Postgres;

public partial class PostgresGateway
{
    public Task<FeatureFlagsResponse> GetFeatureFlagsAsync(string bearerToken, string? correlationId = null, CancellationToken cancellationToken = default)
    {
        // TODO: Implement feature flags query
        throw new NotImplementedException("Feature flags query not yet implemented in PostgresGateway");
    }
}

