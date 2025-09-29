using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Retroscope.Application.Interfaces;
using System.Net;
using Retroscope.Application.DTOs.TeamMembers;

namespace Retroscope.Api.Controllers;

[ApiController]
[Route("api/teams/{teamId}/members")]
[Authorize]
public class TeamMembersController : ControllerBase
{
    private readonly ISupabaseGateway _supabaseGateway;

    public TeamMembersController(ISupabaseGateway supabaseGateway)
    {
        _supabaseGateway = supabaseGateway;
    }

    [HttpGet]
    public async Task<ActionResult<TeamMembersResponse>> GetTeamMembers(string teamId)
    {
        try
        {
            var authHeader = Request.Headers.Authorization.ToString();
            if (string.IsNullOrEmpty(authHeader))
            {
                return Unauthorized();
            }

            // Extract correlation ID from request headers
            var correlationId = Request.Headers["X-Correlation-Id"].FirstOrDefault() 
                ?? Request.Headers["Request-Id"].FirstOrDefault();

            var response = await _supabaseGateway.GetTeamMembersAsync(authHeader, teamId, correlationId);
            return Ok(response);
        }
        catch (UnauthorizedAccessException)
        {
            return Unauthorized();
        }
        catch (Retroscope.Infrastructure.HttpException httpEx) when (httpEx.StatusCode == HttpStatusCode.Unauthorized)
        {
            return Unauthorized();
        }
        catch (Exception)
        {
            return StatusCode(502, new { error = "Downstream service error" });
        }
    }

    [HttpPost]
    public async Task<IActionResult> AddMember(string teamId, [FromBody] AddMemberRequest request)
    {
        try
        {
            var authHeader = Request.Headers.Authorization.ToString();
            if (string.IsNullOrEmpty(authHeader)) return Unauthorized();

            var correlationId = Request.Headers["X-Correlation-Id"].FirstOrDefault()
                ?? Request.Headers["Request-Id"].FirstOrDefault();

            var ok = await _supabaseGateway.AddMemberAsync(authHeader, teamId, request, correlationId);
            if (!ok) return StatusCode(502, new { error = "Failed to add member" });
            return NoContent();
        }
        catch (UnauthorizedAccessException) { return Unauthorized(); }
        catch (Retroscope.Infrastructure.HttpException httpEx) when (httpEx.StatusCode == HttpStatusCode.Unauthorized) { return Unauthorized(); }
        catch (Exception) { return StatusCode(502, new { error = "Downstream service error" }); }
    }

    [HttpPatch("{userId}")]
    public async Task<IActionResult> UpdateMemberRole(string teamId, string userId, [FromBody] UpdateMemberRoleRequest request)
    {
        try
        {
            var authHeader = Request.Headers.Authorization.ToString();
            if (string.IsNullOrEmpty(authHeader)) return Unauthorized();

            var correlationId = Request.Headers["X-Correlation-Id"].FirstOrDefault()
                ?? Request.Headers["Request-Id"].FirstOrDefault();

            var ok = await _supabaseGateway.UpdateMemberRoleAsync(authHeader, teamId, userId, request, correlationId);
            if (!ok) return StatusCode(502, new { error = "Failed to update member role" });
            return NoContent();
        }
        catch (UnauthorizedAccessException) { return Unauthorized(); }
        catch (Retroscope.Infrastructure.HttpException httpEx) when (httpEx.StatusCode == HttpStatusCode.Unauthorized) { return Unauthorized(); }
        catch (Exception) { return StatusCode(502, new { error = "Downstream service error" }); }
    }

    [HttpDelete("{userId}")]
    public async Task<IActionResult> RemoveMember(string teamId, string userId)
    {
        try
        {
            var authHeader = Request.Headers.Authorization.ToString();
            if (string.IsNullOrEmpty(authHeader)) return Unauthorized();

            var correlationId = Request.Headers["X-Correlation-Id"].FirstOrDefault()
                ?? Request.Headers["Request-Id"].FirstOrDefault();

            var ok = await _supabaseGateway.RemoveMemberAsync(authHeader, teamId, userId, correlationId);
            if (!ok) return StatusCode(502, new { error = "Failed to remove member" });
            return NoContent();
        }
        catch (UnauthorizedAccessException) { return Unauthorized(); }
        catch (Retroscope.Infrastructure.HttpException httpEx) when (httpEx.StatusCode == HttpStatusCode.Unauthorized) { return Unauthorized(); }
        catch (Exception) { return StatusCode(502, new { error = "Downstream service error" }); }
    }
}
