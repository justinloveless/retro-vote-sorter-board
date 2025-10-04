using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Retroscope.Application.DTOs.Profiles;
using Retroscope.Application.Interfaces;

namespace Retroscope.Api.Controllers;

[ApiController]
[Route("api/profiles")]
[Authorize]
public sealed class ProfilesController : ControllerBase
{
    private readonly ISupabaseGateway _gateway;
    private readonly ILogger<ProfilesController> _logger;

    public ProfilesController(ISupabaseGateway gateway, ILogger<ProfilesController>? logger = null)
    {
        _gateway = gateway;
        _logger = logger ?? Microsoft.Extensions.Logging.Abstractions.NullLogger<ProfilesController>.Instance;
    }

    /// <summary>
    /// Get a user profile by ID.
    /// </summary>
    /// <param name="userId">The user ID</param>
    /// <param name="ct">Cancellation token</param>
    /// <returns>The user profile</returns>
    [HttpGet("{userId}")]
    [ProducesResponseType(typeof(ProfileResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status502BadGateway)]
    public async Task<IActionResult> GetProfile(string userId, CancellationToken ct)
    {
        var authHeader = Request.Headers.Authorization.FirstOrDefault();
        if (string.IsNullOrWhiteSpace(authHeader))
        {
            return Unauthorized(new { error = "Missing Authorization header" });
        }

        try
        {
            var profile = await _gateway.GetProfileByIdAsync(userId, authHeader, ct);
            return Ok(new ProfileResponse { Profile = profile });
        }
        catch (UnauthorizedAccessException ex)
        {
            _logger.LogWarning(ex, "Unauthorized access when fetching profile {UserId}", userId);
            return Unauthorized(new { error = ex.Message });
        }
        catch (HttpRequestException ex)
        {
            _logger.LogError(ex, "HTTP error when fetching profile {UserId} from Supabase", userId);
            return StatusCode(502, new { error = "Bad Gateway", details = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error when fetching profile {UserId}", userId);
            return StatusCode(500, new { error = "Internal Server Error" });
        }
    }
}

