using System.ComponentModel.DataAnnotations;

namespace Retroscope.Auth.Models;

public class Identity
{
    public Guid Id { get; set; }
    
    public Guid UserId { get; set; }
    
    [Required]
    public string Provider { get; set; } = string.Empty; // 'github', 'google', etc.
    
    [Required]
    public string ProviderUserId { get; set; } = string.Empty;
    
    public string? ProviderData { get; set; } // JSON data from provider
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    
    // Navigation property
    public virtual User User { get; set; } = null!;
}
