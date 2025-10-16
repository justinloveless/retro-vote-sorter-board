using Retroscope.Auth.DTOs;
using Retroscope.Auth.Models;

namespace Retroscope.Auth.Services;

public interface IAuthService
{
    Task<AuthResponse> SignUpAsync(SignUpRequest request);
    Task<AuthResponse> SignInWithPasswordAsync(SignInRequest request);
    Task<AuthResponse> RefreshTokenAsync(RefreshTokenRequest request);
    Task<UserResponse> GetUserAsync(Guid userId);
    Task<string> GetOAuthUrlAsync(string provider, string? redirectTo = null);
    Task<OAuthCallbackResponse> HandleOAuthCallbackAsync(string provider, OAuthCallbackRequest request);
    Task<bool> VerifyEmailAsync(string code);
    Task<bool> ResetPasswordAsync(string email);
    Task<bool> ConfirmPasswordResetAsync(string code, string newPassword);
}
