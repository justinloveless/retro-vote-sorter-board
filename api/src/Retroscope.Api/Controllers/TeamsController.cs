using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Retroscope.Application.DTOs;
using Retroscope.Application.Interfaces;
using System.Net;

namespace Retroscope.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class TeamsController : ControllerBase
{
    private readonly ISupabaseGateway _supabaseGateway;

    public TeamsController(ISupabaseGateway supabaseGateway)
    {
        _supabaseGateway = supabaseGateway;
    }

    [HttpGet]
    public async Task<ActionResult<TeamsResponse>> GetTeams()
    {
        try
        {
            var authHeader = Request.Headers.Authorization.ToString();
            if (string.IsNullOrEmpty(authHeader)) return Unauthorized();

            var correlationId = Request.Headers["X-Correlation-Id"].FirstOrDefault()
                ?? Request.Headers["Request-Id"].FirstOrDefault();

            var response = await _supabaseGateway.GetTeamsAsync(authHeader, correlationId);
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

    [HttpGet("{teamId}")]
    public async Task<ActionResult<TeamDetailsResponse>> GetTeamById(string teamId)
    {
        try
        {
            var authHeader = Request.Headers.Authorization.ToString();
            if (string.IsNullOrEmpty(authHeader)) return Unauthorized();

            var correlationId = Request.Headers["X-Correlation-Id"].FirstOrDefault()
                ?? Request.Headers["Request-Id"].FirstOrDefault();

            var response = await _supabaseGateway.GetTeamByIdAsync(authHeader, teamId, correlationId);
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
        catch (Retroscope.Infrastructure.HttpException httpEx) when (httpEx.StatusCode == HttpStatusCode.Unauthorized)
        {
            return Unauthorized();
        }
        catch (Retroscope.Infrastructure.HttpException httpEx) when (httpEx.StatusCode == HttpStatusCode.NotFound)
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

            var created = await _supabaseGateway.CreateTeamAsync(authHeader, request, correlationId);
            return Created($"/api/teams/{created.Id}", created);
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

    [HttpPatch("{teamId}")]
    public async Task<ActionResult<TeamItem>> UpdateTeam(string teamId, [FromBody] UpdateTeamRequest request)
    {
        try
        {
            var authHeader = Request.Headers.Authorization.ToString();
            if (string.IsNullOrEmpty(authHeader)) return Unauthorized();

            var correlationId = Request.Headers["X-Correlation-Id"].FirstOrDefault()
                ?? Request.Headers["Request-Id"].FirstOrDefault();

            var updated = await _supabaseGateway.UpdateTeamAsync(authHeader, teamId, request, correlationId);
            return Ok(updated);
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

    [HttpDelete("{teamId}")]
    public async Task<IActionResult> DeleteTeam(string teamId)
    {
        try
        {
            var authHeader = Request.Headers.Authorization.ToString();
            if (string.IsNullOrEmpty(authHeader)) return Unauthorized();

            var correlationId = Request.Headers["X-Correlation-Id"].FirstOrDefault()
                ?? Request.Headers["Request-Id"].FirstOrDefault();

            var ok = await _supabaseGateway.DeleteTeamAsync(authHeader, teamId, correlationId);
            if (!ok) return StatusCode(502, new { error = "Failed to delete team" });
            return NoContent();
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
}


