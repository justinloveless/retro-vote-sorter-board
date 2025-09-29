using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Retroscope.Application.Interfaces;
using System.Net;
using Retroscope.Application.DTOs.Notifications;

namespace Retroscope.Api.Controllers;

[ApiController]
[Route("api/admin/notifications")]
[Authorize]
public class AdminNotificationsController(ISupabaseGateway supabaseGateway) : ControllerBase
{
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

            if (string.IsNullOrEmpty(request.Title) || string.IsNullOrEmpty(request.Type))
            {
                return BadRequest(new { error = "Title and Type are required" });
            }

            if (request.Recipients.Count == 0)
            {
                return BadRequest(new { error = "At least one recipient is required" });
            }

            // Extract correlation ID from request headers
            var correlationId = Request.Headers["X-Correlation-Id"].FirstOrDefault() 
                ?? Request.Headers["Request-Id"].FirstOrDefault();

            var response = await supabaseGateway.AdminSendNotificationAsync(authHeader, request, correlationId);
            return Accepted(response);
        }
        catch (UnauthorizedAccessException)
        {
            return Unauthorized();
        }
        catch (Infrastructure.HttpException httpEx) when (httpEx.StatusCode == HttpStatusCode.Unauthorized)
        {
            return Unauthorized();
        }
        catch (Infrastructure.HttpException httpEx) when (httpEx.StatusCode == HttpStatusCode.Forbidden)
        {
            return Forbid();
        }
        catch (Exception)
        {
            return StatusCode(502, new { error = "Downstream service error" });
        }
    }
}