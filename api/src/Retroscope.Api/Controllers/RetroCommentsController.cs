using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Retroscope.Application.DTOs.RetroComments;
using Retroscope.Application.Interfaces;

namespace Retroscope.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/retro-comments")]
public sealed class RetroCommentsController : ControllerBase
{
    private readonly ISupabaseGateway _supabaseGateway;

    public RetroCommentsController(ISupabaseGateway supabaseGateway)
    {
        _supabaseGateway = supabaseGateway;
    }

    [HttpGet("by-items")]
    [ProducesResponseType(typeof(RetroCommentsResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status502BadGateway)]
    public async Task<IActionResult> GetCommentsByItemIds(
        [FromQuery] List<string> itemIds,
        CancellationToken ct)
    {
        var authHeader = Request.Headers.Authorization.FirstOrDefault();
        if (string.IsNullOrWhiteSpace(authHeader))
        {
            return Unauthorized(new { error = "Missing Authorization header" });
        }

        try
        {
            var comments = await _supabaseGateway.GetRetroCommentsByItemIdsAsync(itemIds, authHeader, ct);
            return Ok(new RetroCommentsResponse { Items = comments });
        }
        catch (UnauthorizedAccessException)
        {
            return Unauthorized();
        }
        catch (Exception ex)
        {
            return StatusCode(StatusCodes.Status502BadGateway, new { message = "Failed to retrieve comments.", error = ex.Message });
        }
    }

    [HttpGet("by-item/{itemId}")]
    [ProducesResponseType(typeof(RetroCommentsResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status502BadGateway)]
    public async Task<IActionResult> GetCommentsByItemId(
        string itemId,
        CancellationToken ct)
    {
        var authHeader = Request.Headers.Authorization.FirstOrDefault();
        if (string.IsNullOrWhiteSpace(authHeader))
        {
            return Unauthorized(new { error = "Missing Authorization header" });
        }

        try
        {
            var comments = await _supabaseGateway.GetRetroCommentsByItemIdAsync(itemId, authHeader, ct);
            return Ok(new RetroCommentsResponse { Items = comments });
        }
        catch (UnauthorizedAccessException)
        {
            return Unauthorized();
        }
        catch (Exception ex)
        {
            return StatusCode(StatusCodes.Status502BadGateway, new { message = "Failed to retrieve comments.", error = ex.Message });
        }
    }

    [HttpPost]
    [ProducesResponseType(typeof(RetroCommentItem), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status502BadGateway)]
    public async Task<IActionResult> CreateComment(
        [FromBody] CreateRetroCommentRequest request,
        CancellationToken ct)
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
            var newComment = await _supabaseGateway.CreateRetroCommentAsync(request, authHeader, ct);
            return CreatedAtAction(nameof(GetCommentsByItemId), new { itemId = newComment.ItemId }, newComment);
        }
        catch (UnauthorizedAccessException)
        {
            return Unauthorized();
        }
        catch (Exception ex)
        {
            return StatusCode(StatusCodes.Status502BadGateway, new { message = "Failed to create comment.", error = ex.Message });
        }
    }

    [HttpDelete("{commentId}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status502BadGateway)]
    public async Task<IActionResult> DeleteComment(
        string commentId,
        CancellationToken ct)
    {
        var authHeader = Request.Headers.Authorization.FirstOrDefault();
        if (string.IsNullOrWhiteSpace(authHeader))
        {
            return Unauthorized(new { error = "Missing Authorization header" });
        }

        try
        {
            await _supabaseGateway.DeleteRetroCommentAsync(commentId, authHeader, ct);
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
            return StatusCode(StatusCodes.Status502BadGateway, new { message = "Failed to delete comment.", error = ex.Message });
        }
    }
}

