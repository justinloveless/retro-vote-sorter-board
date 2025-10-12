using Retroscope.Application.DTOs.FeatureFlags;

namespace Retroscope.Application.Interfaces;

public partial interface IPostgresGateway
{
    Task<FeatureFlagsResponse> GetFeatureFlagsAsync(string bearerToken, string? correlationId = null, CancellationToken cancellationToken = default);
}

