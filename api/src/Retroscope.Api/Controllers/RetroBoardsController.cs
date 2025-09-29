using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Retroscope.Application.Interfaces;
using System.Net;
using Retroscope.Application.DTOs.RetroBoard;

namespace Retroscope.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class RetroBoardsController(ISupabaseGateway supabaseGateway) : ControllerBase
{
    [HttpGet("{roomId}/summary")]
    public async Task<ActionResult<RetroBoardTeamSummary>> GetBoardSummary(string roomId)
    {
        try
        {
            var authHeader = Request.Headers.Authorization.ToString();
            if (string.IsNullOrEmpty(authHeader)) return Unauthorized();

            var correlationId = Request.Headers["X-Correlation-Id"].FirstOrDefault()
                ?? Request.Headers["Request-Id"].FirstOrDefault();

            var result = await supabaseGateway.GetRetroBoardTeamSummaryAsync(authHeader, roomId, correlationId, HttpContext.RequestAborted);
            if (result.Board.Id == string.Empty)
            {
                return NotFound();
            }
            return Ok(result);
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
}


