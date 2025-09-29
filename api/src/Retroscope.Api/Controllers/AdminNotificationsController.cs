using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Retroscope.Application.DTOs;
using Retroscope.Application.Interfaces;
using System.Net;
using System.Net.Http;
using Retroscope.Application.DTOs.Notifications;

namespace Retroscope.Api.Controllers;

[ApiController]
[Route("api/admin/notifications")]
[Authorize]
public class AdminNotificationsController : ControllerBase
{
    private readonly ISupabaseGateway _supabaseGateway;

    public AdminNotificationsController(ISupabaseGateway supabaseGateway)
    {
        _supabaseGateway = supabaseGateway;
    }

    [HttpPost]
    public async Task<ActionResult<AdminSendNotificationResponse>> SendNotification([FromBody] AdminSendNotificationRequest request)
    {
        try
        {
            var authHeader = Request.Headers.Authorization.ToString();
            if (string.IsNullOrEmpty(authHeader))
            {
                return Unauthorized();
            }

            if (request == null)
            {
                return BadRequest(new { error = "Request body is required" });
            }

            if (string.IsNullOrEmpty(request.Title) || string.IsNullOrEmpty(request.Type))
            {
                return BadRequest(new { error = "Title and Type are required" });
            }

            if (request.Recipients == null || request.Recipients.Count == 0)
            {
                return BadRequest(new { error = "At least one recipient is required" });
            }

            // Extract correlation ID from request headers
            var correlationId = Request.Headers["X-Correlation-Id"].FirstOrDefault() 
                ?? Request.Headers["Request-Id"].FirstOrDefault();

            var response = await _supabaseGateway.AdminSendNotificationAsync(authHeader, request, correlationId);
            return Accepted(response);
        }
        catch (UnauthorizedAccessException)
        {
            return Unauthorized();
        }
        catch (Retroscope.Infrastructure.HttpException httpEx) when (httpEx.StatusCode == HttpStatusCode.Unauthorized)
        {
            return Unauthorized();
        }
        catch (Retroscope.Infrastructure.HttpException httpEx) when (httpEx.StatusCode == HttpStatusCode.Forbidden)
        {
            return Forbid();
        }
        catch (ForbiddenAccessException)
        {
            return Forbid();
        }
        catch (Exception)
        {
            return StatusCode(502, new { error = "Downstream service error" });
        }
    }
}

// Custom exception for forbidden access
public class ForbiddenAccessException : Exception
{
    public ForbiddenAccessException(string message) : base(message) { }
}
