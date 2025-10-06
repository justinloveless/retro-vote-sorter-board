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
        return await HandleGatewayRequest<TeamsResponse>(async (authHeader, correlationId) =>
        {
            var includeAll = string.Equals(scope, "all", StringComparison.OrdinalIgnoreCase);
            var response = await supabaseGateway.GetTeamsAsync(authHeader, includeAll, correlationId);
            return Ok(response);
        });
    }

    [HttpGet("{teamId}/name")]
    public async Task<ActionResult<TeamNameResponse>> GetTeamName(string teamId)
    {
        return await HandleGatewayRequest<TeamNameResponse>(async (authHeader, correlationId) =>
        {
            var response = await supabaseGateway.GetTeamNameAsync(authHeader, teamId, correlationId);
            return Ok(response);
        });
    }

    [HttpGet("{teamId}")]
    public async Task<ActionResult<TeamDetailsResponse>> GetTeamById(string teamId)
    {
        return await HandleGatewayRequest<TeamDetailsResponse>(async (authHeader, correlationId) =>
        {
            var response = await supabaseGateway.GetTeamByIdAsync(authHeader, teamId, correlationId);
            if (response.Team == null)
            {
                return NotFound();
            }

            return Ok(response);
        });
    }

    [HttpPost]
    public async Task<ActionResult<TeamItem>> CreateTeam([FromBody] CreateTeamRequest request)
    {
        return await HandleGatewayRequest<TeamItem>(async (authHeader, correlationId) =>
        {
            var created = await supabaseGateway.CreateTeamAsync(authHeader, request, correlationId);
            return Created($"/api/teams/{created.Id}", created);
        });
    }

    [HttpPatch("{teamId}")]
    public async Task<ActionResult<TeamItem>> UpdateTeam(string teamId, [FromBody] UpdateTeamRequest request)
    {
        return await HandleGatewayRequest<TeamItem>(async (authHeader, correlationId) =>
        {
            var updated = await supabaseGateway.UpdateTeamAsync(authHeader, teamId, request, correlationId);
            return Ok(updated);
        });
    }

    [HttpDelete("{teamId}")]
    public async Task<IActionResult> DeleteTeam(string teamId)
    {
        return await HandleGatewayRequest(async (authHeader, correlationId) =>
        {
            var ok = await supabaseGateway.DeleteTeamAsync(authHeader, teamId, correlationId);
            if (!ok) return StatusCode(502, new { error = "Failed to delete team" });
            return NoContent();
        });
    }

    private async Task<IActionResult> HandleGatewayRequest(Func<string, string?, Task<IActionResult>> gatewayRequest)
    {
        try
        {
            var authHeader = Request.Headers.Authorization.ToString();
            if (string.IsNullOrEmpty(authHeader)) return Unauthorized();

            var correlationId = Request.Headers["X-Correlation-Id"].FirstOrDefault()
                                ?? Request.Headers["Request-Id"].FirstOrDefault();

            var result = await gatewayRequest(authHeader, correlationId);
            return result;
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
    
    private async Task<ActionResult<T>> HandleGatewayRequest<T>(Func<string, string?, Task<ActionResult<T>>> gatewayRequest)
    {
        try
        {
            var authHeader = Request.Headers.Authorization.ToString();
            if (string.IsNullOrEmpty(authHeader)) return Unauthorized();

            var correlationId = Request.Headers["X-Correlation-Id"].FirstOrDefault()
                                ?? Request.Headers["Request-Id"].FirstOrDefault();

            var result = await gatewayRequest(authHeader, correlationId);
            return result;
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


