using Retroscope.Application.DTOs.Storage;

namespace Retroscope.Infrastructure.Postgres;

public partial class PostgresGateway
{
    public Task<string> UploadAvatarAsync(string bearerToken, AvatarUpload upload, string? correlationId = null, CancellationToken cancellationToken = default)
    {
        // TODO: Implement avatar upload (may need to route to Supabase storage or implement local storage)
        throw new NotImplementedException("Avatar upload not yet implemented in PostgresGateway");
    }

    public Task<string> GetAvatarUrlAsync(string bearerToken, string userId, string? correlationId = null, CancellationToken cancellationToken = default)
    {
        // TODO: Implement get avatar URL
        throw new NotImplementedException("Get avatar URL not yet implemented in PostgresGateway");
    }
}

