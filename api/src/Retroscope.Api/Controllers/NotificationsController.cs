using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Retroscope.Application.DTOs;
using Retroscope.Application.Interfaces;
using System.Net;
using System.Net.Http;
using Retroscope.Application.DTOs.Notifications;

namespace Retroscope.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class NotificationsController : ControllerBase
{
    private readonly ISupabaseGateway _supabaseGateway;

    public NotificationsController(ISupabaseGateway supabaseGateway)
    {
        _supabaseGateway = supabaseGateway;
    }

    [HttpGet]
    public async Task<ActionResult<NotificationsResponse>> GetNotifications([FromQuery] int limit = 50)
    {
        try
        {
            var authHeader = Request.Headers.Authorization.ToString();
            if (string.IsNullOrEmpty(authHeader)) return Unauthorized();

            // Extract correlation ID from request headers
            var correlationId = Request.Headers["X-Correlation-Id"].FirstOrDefault() 
                ?? Request.Headers["Request-Id"].FirstOrDefault();

            var response = await _supabaseGateway.GetNotificationsAsync(authHeader, limit, correlationId);
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

    [HttpPatch("{id}")]
    public async Task<ActionResult<MarkNotificationReadResponse>> MarkNotificationRead(string id, [FromBody] MarkNotificationReadRequest request)
    {
        try
        {
            var authHeader = Request.Headers.Authorization.ToString();
            if (string.IsNullOrEmpty(authHeader)) return Unauthorized();

            // Extract correlation ID from request headers
            var correlationId = Request.Headers["X-Correlation-Id"].FirstOrDefault() 
                ?? Request.Headers["Request-Id"].FirstOrDefault();

            var response = await _supabaseGateway.MarkNotificationReadAsync(authHeader, id, request, correlationId);
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

    [HttpPost("mark-all-read")]
    public async Task<ActionResult<MarkAllNotificationsReadResponse>> MarkAllNotificationsRead([FromBody] MarkAllNotificationsReadRequest request)
    {
        try
        {
            var authHeader = Request.Headers.Authorization.ToString();
            if (string.IsNullOrEmpty(authHeader)) return Unauthorized();

            // Extract correlation ID from request headers
            var correlationId = Request.Headers["X-Correlation-Id"].FirstOrDefault() 
                ?? Request.Headers["Request-Id"].FirstOrDefault();

            var response = await _supabaseGateway.MarkAllNotificationsReadAsync(authHeader, request, correlationId);
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
}
