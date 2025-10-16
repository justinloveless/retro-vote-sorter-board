using System.ComponentModel.DataAnnotations;

namespace Retroscope.Auth.Models;

public class VerificationCode
{
    public Guid Id { get; set; }
    
    public Guid UserId { get; set; }
    
    [Required]
    public string Code { get; set; } = string.Empty;
    
    [Required]
    public string Type { get; set; } = string.Empty; // 'email_verification', 'password_reset'
    
    public DateTime ExpiresAt { get; set; }
    
    public DateTime? UsedAt { get; set; }
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    // Navigation property
    public virtual User User { get; set; } = null!;
}
