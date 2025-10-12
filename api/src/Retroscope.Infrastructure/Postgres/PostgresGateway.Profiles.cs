using Retroscope.Application.DTOs.Profiles;

namespace Retroscope.Infrastructure.Postgres;

public partial class PostgresGateway
{
    public Task<ProfileResponse> GetProfileAsync(string bearerToken, string? correlationId = null, CancellationToken cancellationToken = default)
    {
        // TODO: Implement profile query with RLS
        throw new NotImplementedException("Profile query not yet implemented in PostgresGateway");
    }

    public Task<ProfileResponse> UpdateProfileAsync(string bearerToken, UpdateProfileRequest request, string? correlationId = null, CancellationToken cancellationToken = default)
    {
        // TODO: Implement profile update with RLS
        throw new NotImplementedException("Update profile not yet implemented in PostgresGateway");
    }

    public Task<ProfilesResponse> GetProfilesAsync(string bearerToken, List<string> userIds, string? correlationId = null, CancellationToken cancellationToken = default)
    {
        // TODO: Implement profiles query with RLS
        throw new NotImplementedException("Profiles query not yet implemented in PostgresGateway");
    }
}

