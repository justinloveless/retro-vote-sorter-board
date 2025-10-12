using Microsoft.EntityFrameworkCore;
using Retroscope.Infrastructure.Postgres.Entities;

namespace Retroscope.Infrastructure.Postgres;

public class PostgresContext : DbContext
{
    public PostgresContext(DbContextOptions<PostgresContext> options) : base(options)
    {
    }

    // DbSets for all entities
    public DbSet<Notification> Notifications => Set<Notification>();
    public DbSet<Profile> Profiles => Set<Profile>();
    public DbSet<Team> Teams => Set<Team>();
    public DbSet<TeamMember> TeamMembers => Set<TeamMember>();
    public DbSet<RetroBoard> RetroBoards => Set<RetroBoard>();
    public DbSet<RetroColumn> RetroColumns => Set<RetroColumn>();
    public DbSet<RetroItem> RetroItems => Set<RetroItem>();
    public DbSet<RetroComment> RetroComments => Set<RetroComment>();
    public DbSet<TeamInvitation> TeamInvitations => Set<TeamInvitation>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Configure entities explicitly
        modelBuilder.Entity<Notification>(entity =>
        {
            entity.ToTable("notifications", "public");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("now()");
        });

        modelBuilder.Entity<Profile>(entity =>
        {
            entity.ToTable("profiles", "public");
            entity.HasKey(e => e.Id);
        });

        modelBuilder.Entity<Team>(entity =>
        {
            entity.ToTable("teams", "public");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("now()");
        });

        modelBuilder.Entity<TeamMember>(entity =>
        {
            entity.ToTable("team_members", "public");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("now()");

            // Configure relationships
            entity.HasOne(e => e.Team)
                .WithMany()
                .HasForeignKey(e => e.TeamId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(e => e.Profile)
                .WithMany()
                .HasForeignKey(e => e.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<RetroBoard>(entity =>
        {
            entity.ToTable("retro_boards", "public");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("now()");

            entity.HasOne(e => e.Team)
                .WithMany()
                .HasForeignKey(e => e.TeamId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<RetroColumn>(entity =>
        {
            entity.ToTable("retro_columns", "public");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("now()");

            entity.HasOne(e => e.RetroBoard)
                .WithMany()
                .HasForeignKey(e => e.BoardId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<RetroItem>(entity =>
        {
            entity.ToTable("retro_items", "public");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("now()");

            entity.HasOne(e => e.RetroBoard)
                .WithMany()
                .HasForeignKey(e => e.BoardId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(e => e.RetroColumn)
                .WithMany()
                .HasForeignKey(e => e.ColumnId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<RetroComment>(entity =>
        {
            entity.ToTable("retro_comments", "public");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("now()");

            entity.HasOne(e => e.RetroItem)
                .WithMany()
                .HasForeignKey(e => e.ItemId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<TeamInvitation>(entity =>
        {
            entity.ToTable("team_invitations", "public");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("now()");

            entity.HasOne(e => e.Team)
                .WithMany()
                .HasForeignKey(e => e.TeamId)
                .OnDelete(DeleteBehavior.Cascade);
        });
    }
}

