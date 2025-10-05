using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Retroscope.Application.DTOs.RetroBoards;
using Retroscope.Application.DTOs.RetroBoardConfig;
using Retroscope.Application.DTOs.RetroColumns;
using Retroscope.Application.Interfaces;

namespace Retroscope.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/retroboards")]
public sealed class RetroBoardsController : ControllerBase
{
    private readonly ISupabaseGateway _supabaseGateway;
    private readonly ILogger<RetroBoardsController> _logger;

    public RetroBoardsController(ISupabaseGateway supabaseGateway, ILogger<RetroBoardsController>? logger = null)
    {
        _supabaseGateway = supabaseGateway;
        _logger = logger ?? Microsoft.Extensions.Logging.Abstractions.NullLogger<RetroBoardsController>.Instance;
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

    [HttpGet("{boardId}/config")]
    [ProducesResponseType(typeof(RetroBoardConfigResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status502BadGateway)]
    public async Task<IActionResult> GetRetroBoardConfig(
        string boardId,
        CancellationToken ct)
    {
        var authHeader = Request.Headers.Authorization.FirstOrDefault();
        if (string.IsNullOrWhiteSpace(authHeader))
        {
            return Unauthorized(new { error = "Missing Authorization header" });
        }

        try
        {
            var config = await _supabaseGateway.GetRetroBoardConfigAsync(boardId, authHeader, ct);
            if (config == null)
            {
                return NotFound();
            }
            return Ok(new RetroBoardConfigResponse { Config = config });
        }
        catch (UnauthorizedAccessException ex)
        {
            _logger.LogWarning(ex, "Unauthorized access when fetching retro board config for board {BoardId}", boardId);
            return Unauthorized(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to retrieve retro board config for board {BoardId}", boardId);
            return StatusCode(StatusCodes.Status502BadGateway, new { message = "Failed to retrieve retro board config.", error = ex.Message });
        }
    }

    [HttpPost("config")]
    [ProducesResponseType(typeof(RetroBoardConfigItem), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status502BadGateway)]
    public async Task<IActionResult> CreateRetroBoardConfig(
        [FromBody] CreateRetroBoardConfigRequest request,
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
            var newConfig = await _supabaseGateway.CreateRetroBoardConfigAsync(request, authHeader, ct);
            return CreatedAtAction(nameof(GetRetroBoardConfig), new { boardId = newConfig.BoardId }, newConfig);
        }
        catch (UnauthorizedAccessException ex)
        {
            _logger.LogWarning(ex, "Unauthorized access when creating retro board config");
            return Unauthorized(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to create retro board config", ex);
            return StatusCode(StatusCodes.Status502BadGateway, new { message = "Failed to create retro board config.", error = ex.Message });
        }
    }

    [HttpPatch("{boardId}/config")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status502BadGateway)]
    public async Task<IActionResult> UpdateRetroBoardConfig(
        string boardId,
        [FromBody] UpdateRetroBoardConfigRequest request,
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
            await _supabaseGateway.UpdateRetroBoardConfigAsync(boardId, request, authHeader, ct);
            return NoContent();
        }
        catch (UnauthorizedAccessException ex)
        {
            _logger.LogWarning(ex, "Unauthorized access when updating retro board config for board {BoardId}", boardId);
            return Unauthorized(new { error = ex.Message });
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to update retro board config for board {BoardId}", boardId);
            return StatusCode(StatusCodes.Status502BadGateway, new { message = "Failed to update retro board config.", error = ex.Message });
        }
    }

    [HttpGet("{boardId}/columns")]
    [ProducesResponseType(typeof(RetroColumnsResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status502BadGateway)]
    public async Task<IActionResult> GetRetroColumns(
        string boardId,
        CancellationToken ct)
    {
        var authHeader = Request.Headers.Authorization.FirstOrDefault();
        if (string.IsNullOrWhiteSpace(authHeader))
        {
            return Unauthorized(new { error = "Missing Authorization header" });
        }

        try
        {
            var columns = await _supabaseGateway.GetRetroColumnsAsync(boardId, authHeader, ct);
            return Ok(new RetroColumnsResponse { Items = columns });
        }
        catch (UnauthorizedAccessException ex)
        {
            _logger.LogWarning(ex, "Unauthorized access when fetching retro columns for board {BoardId}", boardId);
            return Unauthorized(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to retrieve retro columns for board {BoardId}", boardId);
            return StatusCode(StatusCodes.Status502BadGateway, new { message = "Failed to retrieve retro columns.", error = ex.Message });
        }
    }

    [HttpPost("columns")]
    [ProducesResponseType(typeof(RetroColumnItem), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status502BadGateway)]
    public async Task<IActionResult> CreateRetroColumn(
        [FromBody] CreateRetroColumnRequest request,
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
            var newColumn = await _supabaseGateway.CreateRetroColumnAsync(request, authHeader, ct);
            return CreatedAtAction(nameof(GetRetroColumns), new { boardId = newColumn.BoardId }, newColumn);
        }
        catch (UnauthorizedAccessException ex)
        {
            _logger.LogWarning(ex, "Unauthorized access when creating retro column");
            return Unauthorized(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to create retro column", ex);
            return StatusCode(StatusCodes.Status502BadGateway, new { message = "Failed to create retro column.", error = ex.Message });
        }
    }

    [HttpPatch("columns/{columnId}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status502BadGateway)]
    public async Task<IActionResult> UpdateRetroColumn(
        string columnId,
        [FromBody] UpdateRetroColumnRequest request,
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
            await _supabaseGateway.UpdateRetroColumnAsync(columnId, request, authHeader, ct);
            return NoContent();
        }
        catch (UnauthorizedAccessException ex)
        {
            _logger.LogWarning(ex, "Unauthorized access when updating retro column {ColumnId}", columnId);
            return Unauthorized(new { error = ex.Message });
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to update retro column {ColumnId}", columnId);
            return StatusCode(StatusCodes.Status502BadGateway, new { message = "Failed to update retro column.", error = ex.Message });
        }
    }

    [HttpDelete("columns/{columnId}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status502BadGateway)]
    public async Task<IActionResult> DeleteRetroColumn(
        string columnId,
        CancellationToken ct)
    {
        var authHeader = Request.Headers.Authorization.FirstOrDefault();
        if (string.IsNullOrWhiteSpace(authHeader))
        {
            return Unauthorized(new { error = "Missing Authorization header" });
        }

        try
        {
            await _supabaseGateway.DeleteRetroColumnAsync(columnId, authHeader, ct);
            return NoContent();
        }
        catch (UnauthorizedAccessException ex)
        {
            _logger.LogWarning(ex, "Unauthorized access when deleting retro column {ColumnId}", columnId);
            return Unauthorized(new { error = ex.Message });
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to delete retro column {ColumnId}", columnId);
            return StatusCode(StatusCodes.Status502BadGateway, new { message = "Failed to delete retro column.", error = ex.Message });
        }
    }

    [HttpPatch("columns/batch")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status502BadGateway)]
    public async Task<IActionResult> UpdateRetroColumnsBatch(
        [FromBody] List<UpdateRetroColumnRequest> requests,
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
            await _supabaseGateway.UpdateRetroColumnsBatchAsync(requests, authHeader, ct);
            return NoContent();
        }
        catch (UnauthorizedAccessException ex)
        {
            _logger.LogWarning(ex, "Unauthorized access when updating retro columns batch");
            return Unauthorized(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to update retro columns batch", ex);
            return StatusCode(StatusCodes.Status502BadGateway, new { message = "Failed to update retro columns batch.", error = ex.Message });
        }
    }
}
