using Retroscope.Application.DTOs.Storage;

namespace Retroscope.Application.Interfaces;

public partial interface IPostgresGateway
{
    Task<string> UploadAvatarAsync(string bearerToken, AvatarUpload upload, string? correlationId = null, CancellationToken cancellationToken = default);
    Task<string> GetAvatarUrlAsync(string bearerToken, string userId, string? correlationId = null, CancellationToken cancellationToken = default);
}

