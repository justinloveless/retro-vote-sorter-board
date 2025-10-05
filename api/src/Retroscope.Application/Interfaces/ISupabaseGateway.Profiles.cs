using Retroscope.Application.DTOs.Profiles;

namespace Retroscope.Application.Interfaces;

public partial interface ISupabaseGateway
{
    /// <summary>
    /// Get a profile by user ID.
    /// </summary>
    Task<ProfileItem> GetProfileByIdAsync(string userId, string authorizationHeader, CancellationToken ct);

    /// <summary>
    /// Get multiple profiles by user IDs.
    /// </summary>
    Task<List<ProfileItem>> GetProfilesByIdsAsync(List<string> userIds, string authorizationHeader, CancellationToken ct);

    /// <summary>
    /// Update a profile by user ID.
    /// </summary>
    Task<ProfileItem> UpdateProfileAsync(string userId, UpdateProfileRequest request, string authorizationHeader, CancellationToken ct);

    /// <summary>
    /// Upsert (insert or update) a profile by user ID.
    /// </summary>
    Task UpsertProfileAsync(string userId, UpdateProfileRequest request, string authorizationHeader, CancellationToken ct);
}

