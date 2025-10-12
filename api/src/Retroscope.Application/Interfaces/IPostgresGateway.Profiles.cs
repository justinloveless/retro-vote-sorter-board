using Retroscope.Application.DTOs.Profiles;

namespace Retroscope.Application.Interfaces;

public partial interface IPostgresGateway
{
    Task<ProfileResponse> GetProfileAsync(string bearerToken, string? correlationId = null, CancellationToken cancellationToken = default);
    Task<ProfileResponse> UpdateProfileAsync(string bearerToken, UpdateProfileRequest request, string? correlationId = null, CancellationToken cancellationToken = default);
    Task<ProfilesResponse> GetProfilesAsync(string bearerToken, List<string> userIds, string? correlationId = null, CancellationToken cancellationToken = default);
}

