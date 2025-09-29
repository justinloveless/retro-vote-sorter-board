

using Retroscope.Application.DTOs.Storage;

namespace Retroscope.Application.Interfaces;

public partial interface ISupabaseGateway
{
    Task<AvatarUploadResponse> UploadAvatarAsync(string bearerToken, string userId, byte[] bytes, string contentType, string? correlationId = null, CancellationToken cancellationToken = default);
    Task<string> GetAvatarPublicUrlAsync(string bearerToken, string userId, string? correlationId = null, CancellationToken cancellationToken = default);

}