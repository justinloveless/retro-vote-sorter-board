using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using System.Net.Http.Headers;

namespace Retroscope.Api.Controllers;

[Route("")]
public class HealthController : ControllerBase
{
    private readonly IConfiguration _configuration;
    private readonly HttpClient _httpClient;
    private readonly ILogger<HealthController> _logger;
    private static DateTime? _lastJwksCheck = null;
    private static bool _jwksHealthy = false;
    private static readonly object _jwksLock = new object();

    public HealthController(IConfiguration configuration, HttpClient httpClient, ILogger<HealthController> logger)
    {
        _configuration = configuration;
        _httpClient = httpClient;
        _logger = logger;
    }

    [HttpGet("healthz")]
    [AllowAnonymous]
    public IActionResult GetHealth()
    {
        return Ok(new { status = "healthy", timestamp = DateTime.UtcNow });
    }

    [HttpGet("readyz")]
    [AllowAnonymous]
    public async Task<IActionResult> GetReadiness()
    {
        try
        {
            var jwksUrl = _configuration["SUPABASE_JWKS_URL"];
            
            if (string.IsNullOrEmpty(jwksUrl))
            {
                _logger.LogWarning("SUPABASE_JWKS_URL not configured");
                return StatusCode(503, new { status = "unhealthy", reason = "JWKS URL not configured" });
            }

            // Check if we need to validate JWKS
            var shouldCheckJwks = false;
            lock (_jwksLock)
            {
                // Check JWKS every 5 minutes or if we haven't checked yet
                if (_lastJwksCheck == null || DateTime.UtcNow.Subtract(_lastJwksCheck.Value).TotalMinutes > 5)
                {
                    shouldCheckJwks = true;
                }
            }

            if (shouldCheckJwks)
            {
                var jwksHealthy = await ValidateJwksEndpoint(jwksUrl);
                lock (_jwksLock)
                {
                    _lastJwksCheck = DateTime.UtcNow;
                    _jwksHealthy = jwksHealthy;
                }
            }

            lock (_jwksLock)
            {
                if (!_jwksHealthy)
                {
                    _logger.LogWarning("JWKS endpoint is not accessible");
                    return StatusCode(503, new { 
                        status = "unhealthy", 
                        reason = "JWKS endpoint not accessible",
                        lastCheck = _lastJwksCheck
                    });
                }
            }

            return Ok(new { 
                status = "ready", 
                timestamp = DateTime.UtcNow,
                jwksLastCheck = _lastJwksCheck,
                jwksHealthy = true
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error checking readiness");
            return StatusCode(503, new { 
                status = "unhealthy", 
                reason = "Internal error",
                error = ex.Message
            });
        }
    }

    private async Task<bool> ValidateJwksEndpoint(string jwksUrl)
    {
        try
        {
            _logger.LogDebug("Validating JWKS endpoint: {JwksUrl}", jwksUrl);
            
            using var request = new HttpRequestMessage(HttpMethod.Get, jwksUrl);
            request.Headers.Add("User-Agent", "Retroscope-API/1.0");
            
            using var response = await _httpClient.SendAsync(request, HttpCompletionOption.ResponseHeadersRead);
            
            if (response.IsSuccessStatusCode)
            {
                _logger.LogDebug("JWKS endpoint validation successful");
                return true;
            }
            
            _logger.LogWarning("JWKS endpoint returned status {StatusCode}", response.StatusCode);
            return false;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to validate JWKS endpoint");
            return false;
        }
    }
}
