using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Retroscope.Application.DTOs.RetroBoards;
using Retroscope.Application.Interfaces;

namespace Retroscope.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/retroboards")]
public sealed class RetroBoardsController : ControllerBase
{
    private readonly ISupabaseGateway _supabaseGateway;

    public RetroBoardsController(ISupabaseGateway supabaseGateway)
    {
        _supabaseGateway = supabaseGateway;
    }

    [HttpGet("team/{teamId}")]
    [ProducesResponseType(typeof(RetroBoardsResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status502BadGateway)]
    public async Task<IActionResult> GetRetroBoards(
        string teamId,
        [FromQuery] bool includeDeleted = false,
        CancellationToken ct = default)
    {
        var authHeader = Request.Headers.Authorization.FirstOrDefault();
        if (string.IsNullOrWhiteSpace(authHeader))
        {
            return Unauthorized(new { error = "Missing Authorization header" });
        }

        try
        {
            var boards = await _supabaseGateway.GetRetroBoardsAsync(teamId, includeDeleted, authHeader, ct);
            return Ok(new RetroBoardsResponse { Items = boards });
        }
        catch (UnauthorizedAccessException)
        {
            return Unauthorized();
        }
        catch (Exception ex)
        {
            return StatusCode(StatusCodes.Status502BadGateway, new { message = "Failed to retrieve retro boards.", error = ex.Message });
        }
    }

    [HttpGet("room/{roomId}/summary")]
    [ProducesResponseType(typeof(RetroBoardSummaryResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status502BadGateway)]
    public async Task<IActionResult> GetRetroBoardSummary(
        string roomId,
        CancellationToken ct = default)
    {
        var authHeader = Request.Headers.Authorization.FirstOrDefault();
        if (string.IsNullOrWhiteSpace(authHeader))
        {
            return Unauthorized(new { error = "Missing Authorization header" });
        }

        try
        {
            var summary = await _supabaseGateway.GetRetroBoardSummaryAsync(roomId, authHeader, ct);
            if (summary == null)
            {
                return NotFound();
            }
            return Ok(summary);
        }
        catch (UnauthorizedAccessException)
        {
            return Unauthorized();
        }
        catch (Exception ex)
        {
            return StatusCode(StatusCodes.Status502BadGateway, new { message = "Failed to retrieve retro board summary.", error = ex.Message });
        }
    }

    [HttpGet("by-ids")]
    [ProducesResponseType(typeof(BoardTitlesResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status502BadGateway)]
    public async Task<IActionResult> GetRetroBoardTitlesByIds(
        [FromQuery] List<string> boardIds,
        CancellationToken ct = default)
    {
        var authHeader = Request.Headers.Authorization.FirstOrDefault();
        if (string.IsNullOrWhiteSpace(authHeader))
        {
            return Unauthorized(new { error = "Missing Authorization header" });
        }

        try
        {
            var titles = await _supabaseGateway.GetRetroBoardTitlesByIdsAsync(boardIds, authHeader, ct);
            return Ok(new BoardTitlesResponse { Items = titles });
        }
        catch (UnauthorizedAccessException)
        {
            return Unauthorized();
        }
        catch (Exception ex)
        {
            return StatusCode(StatusCodes.Status502BadGateway, new { message = "Failed to retrieve board titles.", error = ex.Message });
        }
    }

    [HttpPost]
    [ProducesResponseType(typeof(RetroBoardItem), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status502BadGateway)]
    public async Task<IActionResult> CreateRetroBoard(
        [FromBody] CreateRetroBoardRequest request,
        CancellationToken ct = default)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        var authHeader = Request.Headers.Authorization.FirstOrDefault();
        if (string.IsNullOrWhiteSpace(authHeader))
        {
            return Unauthorized(new { error = "Missing Authorization header" });
        }

        try
        {
            var userId = User.FindFirst("sub")?.Value;
            if (string.IsNullOrWhiteSpace(userId))
            {
                return Unauthorized(new { error = "User ID not found in token" });
            }
            request.CreatorId = userId; // Ensure creator ID is set from authenticated user

            var newBoard = await _supabaseGateway.CreateRetroBoardAsync(request, authHeader, ct);
            return CreatedAtAction(nameof(GetRetroBoardSummary), new { roomId = newBoard.RoomId }, newBoard);
        }
        catch (UnauthorizedAccessException)
        {
            return Unauthorized();
        }
        catch (Exception ex)
        {
            return StatusCode(StatusCodes.Status502BadGateway, new { message = "Failed to create retro board.", error = ex.Message });
        }
    }

    [HttpPatch("{boardId}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status502BadGateway)]
    public async Task<IActionResult> UpdateRetroBoard(
        string boardId,
        [FromBody] UpdateRetroBoardRequest request,
        CancellationToken ct = default)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        var authHeader = Request.Headers.Authorization.FirstOrDefault();
        if (string.IsNullOrWhiteSpace(authHeader))
        {
            return Unauthorized(new { error = "Missing Authorization header" });
        }

        try
        {
            await _supabaseGateway.UpdateRetroBoardAsync(boardId, request, authHeader, ct);
            return NoContent();
        }
        catch (UnauthorizedAccessException)
        {
            return Unauthorized();
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
        catch (Exception ex)
        {
            return StatusCode(StatusCodes.Status502BadGateway, new { message = "Failed to update retro board.", error = ex.Message });
        }
    }

    [HttpDelete("{boardId}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status502BadGateway)]
    public async Task<IActionResult> DeleteRetroBoard(
        string boardId,
        CancellationToken ct = default)
    {
        var authHeader = Request.Headers.Authorization.FirstOrDefault();
        if (string.IsNullOrWhiteSpace(authHeader))
        {
            return Unauthorized(new { error = "Missing Authorization header" });
        }

        try
        {
            await _supabaseGateway.DeleteRetroBoardAsync(boardId, authHeader, ct);
            return NoContent();
        }
        catch (UnauthorizedAccessException)
        {
            return Unauthorized();
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
        catch (Exception ex)
        {
            return StatusCode(StatusCodes.Status502BadGateway, new { message = "Failed to delete retro board.", error = ex.Message });
        }
    }
}
