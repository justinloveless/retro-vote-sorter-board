using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Retroscope.Auth.DTOs;
using Retroscope.Auth.Services;
using System.Security.Claims;

namespace Retroscope.Auth.Controllers;

[ApiController]
[Route("auth/v1")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _authService;
    private readonly ILogger<AuthController> _logger;

    public AuthController(IAuthService authService, ILogger<AuthController> logger)
    {
        _authService = authService;
        _logger = logger;
    }

    [HttpPost("signup")]
    public async Task<IActionResult> SignUp([FromBody] SignUpRequest request)
    {
        try
        {
            var result = await _authService.SignUpAsync(request);
            return Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during signup");
            return StatusCode(500, new { error = "Internal server error" });
        }
    }

    [HttpPost("token")]
    public async Task<IActionResult> SignIn([FromQuery] string grant_type, [FromBody] SignInRequest request)
    {
        try
        {
            if (grant_type != "password")
            {
                return BadRequest(new { error = "Unsupported grant type" });
            }

            var result = await _authService.SignInWithPasswordAsync(request);
            return Ok(result);
        }
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during signin");
            return StatusCode(500, new { error = "Internal server error" });
        }
    }

    [HttpPost("refresh")]
    public async Task<IActionResult> RefreshToken([FromBody] RefreshTokenRequest request)
    {
        try
        {
            var result = await _authService.RefreshTokenAsync(request);
            return Ok(result);
        }
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during token refresh");
            return StatusCode(500, new { error = "Internal server error" });
        }
    }

    [HttpGet("authorize")]
    public async Task<IActionResult> OAuthAuthorize([FromQuery] string provider, [FromQuery] string? redirect_to)
    {
        try
        {
            var authUrl = await _authService.GetOAuthUrlAsync(provider, redirect_to);
            return Redirect(authUrl);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating OAuth URL");
            return StatusCode(500, new { error = "Internal server error" });
        }
    }

    [HttpGet("callback")]
    public async Task<IActionResult> OAuthCallback([FromQuery] string provider, [FromQuery] string code, [FromQuery] string? state)
    {
        try
        {
            var request = new OAuthCallbackRequest
            {
                Code = code,
                State = state
            };

            var result = await _authService.HandleOAuthCallbackAsync(provider, request);
            return Redirect($"{result.RedirectUrl}?access_token={result.AccessToken}&refresh_token={result.RefreshToken}");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during OAuth callback");
            return StatusCode(500, new { error = "Internal server error" });
        }
    }

    [HttpGet("user")]
    [Authorize]
    public async Task<IActionResult> GetUser()
    {
        try
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdClaim) || !Guid.TryParse(userIdClaim, out var userId))
            {
                return Unauthorized(new { error = "Invalid user ID" });
            }

            var user = await _authService.GetUserAsync(userId);
            return Ok(new { user });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting user");
            return StatusCode(500, new { error = "Internal server error" });
        }
    }

    [HttpPost("verify")]
    public async Task<IActionResult> VerifyEmail([FromBody] VerifyEmailRequest request)
    {
        try
        {
            var success = await _authService.VerifyEmailAsync(request.Code);
            if (success)
            {
                return Ok(new { message = "Email verified successfully" });
            }
            return BadRequest(new { error = "Invalid or expired verification code" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error verifying email");
            return StatusCode(500, new { error = "Internal server error" });
        }
    }

    [HttpPost("reset-password")]
    public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordRequest request)
    {
        try
        {
            var success = await _authService.ResetPasswordAsync(request.Email);
            return Ok(new { message = "If the email exists, a reset code has been sent" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error resetting password");
            return StatusCode(500, new { error = "Internal server error" });
        }
    }

    [HttpPost("confirm-password-reset")]
    public async Task<IActionResult> ConfirmPasswordReset([FromBody] ConfirmPasswordResetRequest request)
    {
        try
        {
            var success = await _authService.ConfirmPasswordResetAsync(request.Code, request.NewPassword);
            if (success)
            {
                return Ok(new { message = "Password reset successfully" });
            }
            return BadRequest(new { error = "Invalid or expired reset code" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error confirming password reset");
            return StatusCode(500, new { error = "Internal server error" });
        }
    }
}

// Additional DTOs for the controller
public class VerifyEmailRequest
{
    public string Code { get; set; } = string.Empty;
}

public class ResetPasswordRequest
{
    public string Email { get; set; } = string.Empty;
}

public class ConfirmPasswordResetRequest
{
    public string Code { get; set; } = string.Empty;
    public string NewPassword { get; set; } = string.Empty;
}
