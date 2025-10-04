using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Retroscope.Application.DTOs.TeamInvitations;
using Retroscope.Application.Interfaces;

namespace Retroscope.Api.Controllers;

[ApiController]
[Route("api/teams/{teamId}/invitations")]
[Authorize]
public sealed class TeamInvitationsController : ControllerBase
{
    private readonly ISupabaseGateway _gateway;
    private readonly ILogger<TeamInvitationsController> _logger;

    public TeamInvitationsController(ISupabaseGateway gateway, ILogger<TeamInvitationsController>? logger = null)
    {
        _gateway = gateway;
        _logger = logger ?? Microsoft.Extensions.Logging.Abstractions.NullLogger<TeamInvitationsController>.Instance;
    }

    /// <summary>
    /// Get team invitations
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(TeamInvitationsResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status502BadGateway)]
    public async Task<IActionResult> GetInvitations(
        string teamId,
        [FromQuery] string? inviteType,
        [FromQuery] string? status,
        CancellationToken ct)
    {
        var authHeader = Request.Headers.Authorization.FirstOrDefault();
        if (string.IsNullOrWhiteSpace(authHeader))
        {
            return Unauthorized(new { error = "Missing Authorization header" });
        }

        try
        {
            var invitations = await _gateway.GetTeamInvitationsAsync(teamId, inviteType, status, authHeader, ct);
            return Ok(new TeamInvitationsResponse { Items = invitations });
        }
        catch (UnauthorizedAccessException ex)
        {
            _logger.LogWarning(ex, "Unauthorized access when fetching invitations for team {TeamId}", teamId);
            return Unauthorized(new { error = ex.Message });
        }
        catch (HttpRequestException ex)
        {
            _logger.LogError(ex, "HTTP error when fetching invitations for team {TeamId} from Supabase", teamId);
            return StatusCode(502, new { error = "Bad Gateway", details = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error when fetching invitations for team {TeamId}", teamId);
            return StatusCode(500, new { error = "Internal Server Error" });
        }
    }

    /// <summary>
    /// Create a team invitation
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof(TeamInvitationItem), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status502BadGateway)]
    public async Task<IActionResult> CreateInvitation(
        string teamId,
        [FromBody] CreateTeamInvitationRequest request,
        CancellationToken ct)
    {
        var authHeader = Request.Headers.Authorization.FirstOrDefault();
        if (string.IsNullOrWhiteSpace(authHeader))
        {
            return Unauthorized(new { error = "Missing Authorization header" });
        }

        var userId = User.FindFirst("sub")?.Value;
        if (string.IsNullOrWhiteSpace(userId))
        {
            return Unauthorized(new { error = "User ID not found in token" });
        }

        try
        {
            var invitation = await _gateway.CreateTeamInvitationAsync(teamId, request, userId, authHeader, ct);
            return CreatedAtAction(nameof(GetInvitations), new { teamId }, invitation);
        }
        catch (UnauthorizedAccessException ex)
        {
            _logger.LogWarning(ex, "Unauthorized access when creating invitation for team {TeamId}", teamId);
            return Unauthorized(new { error = ex.Message });
        }
        catch (HttpRequestException ex)
        {
            _logger.LogError(ex, "HTTP error when creating invitation for team {TeamId}", teamId);
            return StatusCode(502, new { error = "Bad Gateway", details = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error when creating invitation for team {TeamId}", teamId);
            return StatusCode(500, new { error = "Internal Server Error" });
        }
    }

    /// <summary>
    /// Update a team invitation
    /// </summary>
    [HttpPatch("{invitationId}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status502BadGateway)]
    public async Task<IActionResult> UpdateInvitation(
        string invitationId,
        [FromBody] UpdateTeamInvitationRequest request,
        CancellationToken ct)
    {
        var authHeader = Request.Headers.Authorization.FirstOrDefault();
        if (string.IsNullOrWhiteSpace(authHeader))
        {
            return Unauthorized(new { error = "Missing Authorization header" });
        }

        try
        {
            await _gateway.UpdateTeamInvitationAsync(invitationId, request, authHeader, ct);
            return NoContent();
        }
        catch (UnauthorizedAccessException ex)
        {
            _logger.LogWarning(ex, "Unauthorized access when updating invitation {InvitationId}", invitationId);
            return Unauthorized(new { error = ex.Message });
        }
        catch (HttpRequestException ex)
        {
            _logger.LogError(ex, "HTTP error when updating invitation {InvitationId}", invitationId);
            return StatusCode(502, new { error = "Bad Gateway", details = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error when updating invitation {InvitationId}", invitationId);
            return StatusCode(500, new { error = "Internal Server Error" });
        }
    }

    /// <summary>
    /// Delete a team invitation
    /// </summary>
    [HttpDelete("{invitationId}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status502BadGateway)]
    public async Task<IActionResult> DeleteInvitation(
        string invitationId,
        CancellationToken ct)
    {
        var authHeader = Request.Headers.Authorization.FirstOrDefault();
        if (string.IsNullOrWhiteSpace(authHeader))
        {
            return Unauthorized(new { error = "Missing Authorization header" });
        }

        try
        {
            await _gateway.DeleteTeamInvitationAsync(invitationId, authHeader, ct);
            return NoContent();
        }
        catch (UnauthorizedAccessException ex)
        {
            _logger.LogWarning(ex, "Unauthorized access when deleting invitation {InvitationId}", invitationId);
            return Unauthorized(new { error = ex.Message });
        }
        catch (HttpRequestException ex)
        {
            _logger.LogError(ex, "HTTP error when deleting invitation {InvitationId}", invitationId);
            return StatusCode(502, new { error = "Bad Gateway", details = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error when deleting invitation {InvitationId}", invitationId);
            return StatusCode(500, new { error = "Internal Server Error" });
        }
    }
}

