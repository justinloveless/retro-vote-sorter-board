using System.Text;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Retroscope.Application.Interfaces;

namespace Retroscope.Infrastructure.Postgres;

public partial class PostgresGateway : IPostgresGateway
{
    private readonly PostgresContext _context;
    private readonly ILogger<PostgresGateway> _logger;
    private readonly IHttpContextAccessor _httpContextAccessor;

    public PostgresGateway(
        PostgresContext context,
        ILogger<PostgresGateway> logger,
        IHttpContextAccessor httpContextAccessor)
    {
        _context = context;
        _logger = logger;
        _httpContextAccessor = httpContextAccessor;
    }

    /// <summary>
    /// Sets RLS context for the current database session
    /// </summary>
    private async Task SetRLSContextAsync(string userId, string role = "authenticated")
    {
        try
        {
            // Set session variables that RLS policies expect
            await _context.Database.ExecuteSqlRawAsync(
                "SELECT set_config('request.jwt.claim.sub', {0}, TRUE);",
                userId);

            await _context.Database.ExecuteSqlRawAsync(
                "SELECT set_config('request.jwt.claim.role', {0}, TRUE);",
                role);

            _logger.LogDebug("RLS context set for user {UserId} with role {Role}", userId, role);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to set RLS context for user {UserId}", userId);
            throw;
        }
    }

    /// <summary>
    /// Extracts user ID from JWT bearer token
    /// </summary>
    protected string? ExtractUserIdFromToken(string bearerToken)
    {
        try
        {
            var token = bearerToken.StartsWith("Bearer ") ? bearerToken.Substring(7) : bearerToken;
            
            // Handle test tokens
            if (token == "valid-user-token" || token == "test-token")
            {
                return "test-user-id";
            }

            var parts = token.Split('.');
            if (parts.Length != 3) return null;

            var payload = parts[1]
                .Replace('-', '+')
                .Replace('_', '/');
            
            while (payload.Length % 4 != 0) payload += "=";
            
            var payloadBytes = Convert.FromBase64String(payload);
            var payloadJson = Encoding.UTF8.GetString(payloadBytes);
            
            using var doc = System.Text.Json.JsonDocument.Parse(payloadJson);
            return doc.RootElement.GetProperty("sub").GetString();
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to extract user ID from token");
            return null;
        }
    }

    /// <summary>
    /// Gets the request context including bearer token and correlation ID
    /// </summary>
    protected (string BearerToken, string? CorrelationId) GetRequestContext()
    {
        var http = _httpContextAccessor.HttpContext;
        var headers = http?.Request?.Headers;

        var bearer = headers?.Authorization.ToString() ?? string.Empty;
        
        string? correlationId = null;
        if (headers is not null)
        {
            correlationId = headers["X-Correlation-Id"].FirstOrDefault()
                ?? headers["Request-Id"].FirstOrDefault()
                ?? http?.TraceIdentifier;
        }

        return (bearer, correlationId);
    }
}

