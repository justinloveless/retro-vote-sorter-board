using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Retroscope.Application.DTOs;
using Retroscope.Application.Interfaces;
using System.Net;

namespace Retroscope.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class AvatarsController : ControllerBase
{
    private readonly ISupabaseGateway _supabaseGateway;

    public AvatarsController(ISupabaseGateway supabaseGateway)
    {
        _supabaseGateway = supabaseGateway;
    }

    [HttpPost("{userId}")]
    [RequestSizeLimit(5_000_000)] // 5MB limit
    public async Task<ActionResult<AvatarUploadResponse>> UploadAvatar(string userId)
    {
        try
        {
            var authHeader = Request.Headers.Authorization.ToString();
            if (string.IsNullOrEmpty(authHeader)) return Unauthorized();

            if (!Request.HasFormContentType || Request.Form.Files.Count == 0)
            {
                return BadRequest(new { error = "No file provided" });
            }

            var file = Request.Form.Files[0];
            await using var ms = new MemoryStream();
            await file.CopyToAsync(ms);
            var bytes = ms.ToArray();
            var contentType = string.IsNullOrWhiteSpace(file.ContentType) ? "image/png" : file.ContentType;

            var correlationId = Request.Headers["X-Correlation-Id"].FirstOrDefault()
                ?? Request.Headers["Request-Id"].FirstOrDefault();

            var result = await _supabaseGateway.UploadAvatarAsync(authHeader, userId, bytes, contentType, correlationId, HttpContext.RequestAborted);
            return Ok(result);
        }
        catch (UnauthorizedAccessException)
        {
            return Unauthorized();
        }
        catch (Retroscope.Infrastructure.HttpException httpEx) when (httpEx.StatusCode == HttpStatusCode.Unauthorized)
        {
            return Unauthorized();
        }
        catch (Exception ex)
        {
            return StatusCode(502, new { error = ex.Message });
        }
    }
}


