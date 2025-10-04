using Retroscope.Application.DTOs.Profiles;

namespace Retroscope.Application.Interfaces;

public partial interface ISupabaseGateway
{
    /// <summary>
    /// Get a profile by user ID.
    /// </summary>
    Task<ProfileItem> GetProfileByIdAsync(string userId, string authorizationHeader, CancellationToken ct);
}

