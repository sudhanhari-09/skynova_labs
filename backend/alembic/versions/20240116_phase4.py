"""Phase 4 Alembic Migration - Project Management, Team, Tasks, Milestones

Revision ID: 20240116_phase4
Revises: 20240115_phase3
Create: 2024-01-16 00:00:00

This migration creates Phase 4 database tables:
- projects
- project_members
- milestones
- tasks
- task_comments
- project_updates
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20240116_phase4'
down_revision = '20240115_phase3'
branch_labels = None
depends_on = None


def upgrade():
    # Create projects table
    op.create_table(
        'projects',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('project_number', sa.String(), nullable=False),
        sa.Column('contract_id', sa.Integer(), nullable=True),
        sa.Column('lead_id', sa.Integer(), nullable=True),
        sa.Column('quotation_id', sa.Integer(), nullable=True),
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('acronym', sa.String(), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('status', sa.String(), nullable=False, server_default='PLANNING'),
        sa.Column('priority', sa.String(), nullable=False, server_default='MEDIUM'),
        sa.Column('manager_id', sa.Integer(), nullable=True),
        sa.Column('project_type_id', sa.Integer(), nullable=True),
        sa.Column('subcategory_id', sa.Integer(), nullable=True),
        sa.Column('start_date', sa.DateTime(), nullable=True),
        sa.Column('target_end_date', sa.DateTime(), nullable=True),
        sa.Column('actual_end_date', sa.DateTime(), nullable=True),
        sa.Column('full_budget', sa.Numeric(precision=14, scale=2), nullable=True),
        sa.Column('reserved_budget', sa.Numeric(precision=14, scale=2), nullable=True),
        sa.Column('customer_budget', sa.Numeric(precision=14, scale=2), nullable=True),
        sa.Column('currency', sa.String(), nullable=False, server_default='USD'),
        sa.Column('secure_reference', sa.String(), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['contract_id'], ['contracts.id'], ),
        sa.ForeignKeyConstraint(['lead_id'], ['leads.id'], ),
        sa.ForeignKeyConstraint(['quotation_id'], ['quotations.id'], ),
        sa.ForeignKeyConstraint(['manager_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['project_type_id'], ['project_types.id'], ),
        sa.ForeignKeyConstraint(['subcategory_id'], ['project_subcategories.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_projects_project_number', 'projects', ['project_number'], unique=True)
    op.create_index('ix_projects_secure_reference', 'projects', ['secure_reference'], unique=True)
    op.create_index('ix_projects_contract_id', 'projects', ['contract_id'], unique=False)
    op.create_index('ix_projects_lead_id', 'projects', ['lead_id'], unique=False)
    op.create_index('ix_projects_status', 'projects', ['status'], unique=False)

    # Create project_members table
    op.create_table(
        'project_members',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('project_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('role', sa.String(), nullable=False),
        sa.Column('is_lead', sa.Boolean(), nullable=False, server_default='0'),
        sa.Column('status', sa.String(), nullable=False, server_default='ACTIVE'),
        sa.Column('joined_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('project_id', 'user_id', name='uq_project_member'),
    )
    op.create_index('ix_project_members_project_id', 'project_members', ['project_id'], unique=False)
    op.create_index('ix_project_members_user_id', 'project_members', ['user_id'], unique=False)

    # Create milestones table
    op.create_table(
        'milestones',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('project_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('due_date', sa.DateTime(), nullable=True),
        sa.Column('status', sa.String(), nullable=False, server_default='PENDING'),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.Column('display_order', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_milestones_project_id', 'milestones', ['project_id'], unique=False)

    # Create tasks table
    op.create_table(
        'tasks',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('project_id', sa.Integer(), nullable=False),
        sa.Column('milestone_id', sa.Integer(), nullable=True),
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('assignee_id', sa.Integer(), nullable=True),
        sa.Column('status', sa.String(), nullable=False, server_default='TODO'),
        sa.Column('priority', sa.String(), nullable=False, server_default='MEDIUM'),
        sa.Column('due_date', sa.DateTime(), nullable=True),
        sa.Column('estimated_hours', sa.Numeric(precision=8, scale=2), nullable=True),
        sa.Column('actual_hours', sa.Numeric(precision=8, scale=2), nullable=True),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.Column('display_order', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['milestone_id'], ['milestones.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['assignee_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_tasks_project_id', 'tasks', ['project_id'], unique=False)
    op.create_index('ix_tasks_milestone_id', 'tasks', ['milestone_id'], unique=False)
    op.create_index('ix_tasks_assignee_id', 'tasks', ['assignee_id'], unique=False)
    op.create_index('ix_tasks_status', 'tasks', ['status'], unique=False)

    # Create task_comments table
    op.create_table(
        'task_comments',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('task_id', sa.Integer(), nullable=False),
        sa.Column('author_id', sa.Integer(), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('is_internal', sa.Boolean(), nullable=False, server_default='1'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['task_id'], ['tasks.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['author_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_task_comments_task_id', 'task_comments', ['task_id'], unique=False)

    # Create project_updates table
    op.create_table(
        'project_updates',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('project_id', sa.Integer(), nullable=False),
        sa.Column('author_id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('content', sa.Text(), nullable=True),
        sa.Column('update_type', sa.String(), nullable=False, server_default='GENERAL'),
        sa.Column('status', sa.String(), nullable=True),
        sa.Column('is_internal', sa.Boolean(), nullable=False, server_default='1'),
        sa.Column('is_user_visible', sa.Boolean(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['author_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_project_updates_project_id', 'project_updates', ['project_id'], unique=False)


def downgrade():
    op.drop_table('project_updates')
    op.drop_index('ix_project_updates_project_id', table_name='project_updates')
    op.drop_table('task_comments')
    op.drop_index('ix_task_comments_task_id', table_name='task_comments')
    op.drop_table('tasks')
    op.drop_index('ix_tasks_status', table_name='tasks')
    op.drop_index('ix_tasks_assignee_id', table_name='tasks')
    op.drop_index('ix_tasks_milestone_id', table_name='tasks')
    op.drop_index('ix_tasks_project_id', table_name='tasks')
    op.drop_table('milestones')
    op.drop_index('ix_milestones_project_id', table_name='milestones')
    op.drop_table('project_members')
    op.drop_index('ix_project_members_user_id', table_name='project_members')
    op.drop_index('ix_project_members_project_id', table_name='project_members')
    op.drop_table('projects')
    op.drop_index('ix_projects_status', table_name='projects')
    op.drop_index('ix_projects_lead_id', table_name='projects')
    op.drop_index('ix_projects_contract_id', table_name='projects')
    op.drop_index('ix_projects_secure_reference', table_name='projects')
    op.drop_index('ix_projects_project_number', table_name='projects')
