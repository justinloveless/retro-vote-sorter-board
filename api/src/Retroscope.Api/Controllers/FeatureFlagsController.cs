using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Retroscope.Application.DTOs;
using Retroscope.Application.Interfaces;
using System.Net;

namespace Retroscope.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class FeatureFlagsController : ControllerBase
{
    private readonly ISupabaseGateway _supabaseGateway;

    public FeatureFlagsController(ISupabaseGateway supabaseGateway)
    {
        _supabaseGateway = supabaseGateway;
    }

    [HttpGet]
    public async Task<ActionResult<FeatureFlagsResponse>> GetFeatureFlags()
    {
        try
        {
            var authHeader = Request.Headers.Authorization.ToString();
            if (string.IsNullOrEmpty(authHeader)) return Unauthorized();

            var correlationId = Request.Headers["X-Correlation-Id"].FirstOrDefault()
                ?? Request.Headers["Request-Id"].FirstOrDefault();

            var response = await _supabaseGateway.GetFeatureFlagsAsync(authHeader, correlationId);
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

    [HttpPatch("{flagName}")]
    public async Task<IActionResult> UpdateFeatureFlag(string flagName, [FromBody] bool is_enabled)
    {
        try
        {
            var authHeader = Request.Headers.Authorization.ToString();
            if (string.IsNullOrEmpty(authHeader)) return Unauthorized();

            var correlationId = Request.Headers["X-Correlation-Id"].FirstOrDefault()
                ?? Request.Headers["Request-Id"].FirstOrDefault();

            var ok = await _supabaseGateway.UpdateFeatureFlagAsync(authHeader, flagName, is_enabled, correlationId);
            if (!ok) return StatusCode(502, new { error = "Failed to update feature flag" });
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


