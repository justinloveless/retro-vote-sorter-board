using Retroscope.Application.DTOs.FeatureFlags;

namespace Retroscope.Application.Interfaces;

public partial interface ISupabaseGateway
{
    Task<FeatureFlagsResponse> GetFeatureFlagsAsync(string bearerToken, string? correlationId = null, CancellationToken cancellationToken = default);
    Task<bool> UpdateFeatureFlagAsync(string bearerToken, string flagName, bool isEnabled, string? correlationId = null, CancellationToken cancellationToken = default);

}