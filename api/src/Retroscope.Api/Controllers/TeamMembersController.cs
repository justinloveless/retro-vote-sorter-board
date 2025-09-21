using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Retroscope.Application.DTOs;
using Retroscope.Application.Interfaces;

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
        catch (Exception)
        {
            return StatusCode(502, new { error = "Downstream service error" });
        }
    }
}
