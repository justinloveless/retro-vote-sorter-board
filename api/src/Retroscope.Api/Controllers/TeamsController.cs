using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Retroscope.Application.Interfaces;
using System.Net;
using Retroscope.Application.DTOs.Teams;

namespace Retroscope.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class TeamsController(ISupabaseGateway supabaseGateway) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<TeamsResponse>> GetTeams([FromQuery] string? scope = null)
    {
        try
        {
            var authHeader = Request.Headers.Authorization.ToString();
            if (string.IsNullOrEmpty(authHeader)) return Unauthorized();

            var correlationId = Request.Headers["X-Correlation-Id"].FirstOrDefault()
                ?? Request.Headers["Request-Id"].FirstOrDefault();

            var includeAll = string.Equals(scope, "all", StringComparison.OrdinalIgnoreCase);
            var response = await supabaseGateway.GetTeamsAsync(authHeader, includeAll, correlationId);
            return Ok(response);
        }
        catch (UnauthorizedAccessException)
        {
            return Unauthorized();
        }
        catch (Infrastructure.HttpException httpEx) when (httpEx.StatusCode == HttpStatusCode.Unauthorized)
        {
            return Unauthorized();
        }
        catch (Exception)
        {
            return StatusCode(502, new { error = "Downstream service error" });
        }
    }

    [HttpGet("{teamId}")]
    public async Task<ActionResult<TeamDetailsResponse>> GetTeamById(string teamId)
    {
        try
        {
            var authHeader = Request.Headers.Authorization.ToString();
            if (string.IsNullOrEmpty(authHeader)) return Unauthorized();

            var correlationId = Request.Headers["X-Correlation-Id"].FirstOrDefault()
                ?? Request.Headers["Request-Id"].FirstOrDefault();

            var response = await supabaseGateway.GetTeamByIdAsync(authHeader, teamId, correlationId);
            if (response.Team == null)
            {
                return NotFound();
            }

            return Ok(response);
        }
        catch (UnauthorizedAccessException)
        {
            return Unauthorized();
        }
        catch (Infrastructure.HttpException httpEx) when (httpEx.StatusCode == HttpStatusCode.Unauthorized)
        {
            return Unauthorized();
        }
        catch (Infrastructure.HttpException httpEx) when (httpEx.StatusCode == HttpStatusCode.NotFound)
        {
            return NotFound();
        }
        catch (Exception)
        {
            return StatusCode(502, new { error = "Downstream service error" });
        }
    }

    [HttpPost]
    public async Task<ActionResult<TeamItem>> CreateTeam([FromBody] CreateTeamRequest request)
    {
        try
        {
            var authHeader = Request.Headers.Authorization.ToString();
            if (string.IsNullOrEmpty(authHeader)) return Unauthorized();

            var correlationId = Request.Headers["X-Correlation-Id"].FirstOrDefault()
                ?? Request.Headers["Request-Id"].FirstOrDefault();

            var created = await supabaseGateway.CreateTeamAsync(authHeader, request, correlationId);
            return Created($"/api/teams/{created.Id}", created);
        }
        catch (UnauthorizedAccessException)
        {
            return Unauthorized();
        }
        catch (Infrastructure.HttpException httpEx) when (httpEx.StatusCode == HttpStatusCode.Unauthorized)
        {
            return Unauthorized();
        }
        catch (Exception)
        {
            return StatusCode(502, new { error = "Downstream service error" });
        }
    }

    [HttpPatch("{teamId}")]
    public async Task<ActionResult<TeamItem>> UpdateTeam(string teamId, [FromBody] UpdateTeamRequest request)
    {
        try
        {
            var authHeader = Request.Headers.Authorization.ToString();
            if (string.IsNullOrEmpty(authHeader)) return Unauthorized();

            var correlationId = Request.Headers["X-Correlation-Id"].FirstOrDefault()
                ?? Request.Headers["Request-Id"].FirstOrDefault();

            var updated = await supabaseGateway.UpdateTeamAsync(authHeader, teamId, request, correlationId);
            return Ok(updated);
        }
        catch (UnauthorizedAccessException)
        {
            return Unauthorized();
        }
        catch (Infrastructure.HttpException httpEx) when (httpEx.StatusCode == HttpStatusCode.Unauthorized)
        {
            return Unauthorized();
        }
        catch (Exception)
        {
            return StatusCode(502, new { error = "Downstream service error" });
        }
    }

    [HttpDelete("{teamId}")]
    public async Task<IActionResult> DeleteTeam(string teamId)
    {
        try
        {
            var authHeader = Request.Headers.Authorization.ToString();
            if (string.IsNullOrEmpty(authHeader)) return Unauthorized();

            var correlationId = Request.Headers["X-Correlation-Id"].FirstOrDefault()
                ?? Request.Headers["Request-Id"].FirstOrDefault();

            var ok = await supabaseGateway.DeleteTeamAsync(authHeader, teamId, correlationId);
            if (!ok) return StatusCode(502, new { error = "Failed to delete team" });
            return NoContent();
        }
        catch (UnauthorizedAccessException)
        {
            return Unauthorized();
        }
        catch (Infrastructure.HttpException httpEx) when (httpEx.StatusCode == HttpStatusCode.Unauthorized)
        {
            return Unauthorized();
        }
        catch (Exception)
        {
            return StatusCode(502, new { error = "Downstream service error" });
        }
    }
}


