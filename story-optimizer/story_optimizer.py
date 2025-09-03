#!/usr/bin/env python3
"""
DSPy-based story optimization system for Discord newsletter generation.

This system optimizes:
1. Topic extraction quality 
2. Story generation effectiveness
3. Overall newspaper coherence

Usage:
    python story_optimizer.py --mode evaluate --run test-001
    python story_optimizer.py --mode optimize --run test-001
"""

import json
import os
import sys
from pathlib import Path
from typing import List, Dict, Any
import dspy
from dataclasses import dataclass


@dataclass
class WorkflowData:
    """Data container for workflow run artifacts"""
    run_dir: Path
    messages: List[Dict]
    message_map: str
    topics: Dict
    raw_response: str
    prompt_template: str


# ========== DSPy Signatures ==========

class StoryQualityBreakdown(dspy.Signature):
    """
    Analyze a news story and break it down into key quality dimensions.
    
    Rate each dimension on importance (High/Medium/Low) and 
    evaluate story performance in each area.
    """
    
    original_messages = dspy.InputField(desc="Raw Discord messages that were source material")
    story_content = dspy.InputField(desc="The generated news story to evaluate")
    
    quality_dimensions: str = dspy.OutputField(
        desc="numbered list of quality dimensions with importance grades, "
             "e.g. '1. Factual accuracy - captures real events. High'"
    )
    importance_grades: List[str] = dspy.OutputField(
        desc="list of importance grades matching dimensions, "
             "e.g. ['High', 'Medium', 'Low']"
    )


class StoryQualityScoring(dspy.Signature):
    """
    Score a story against specific quality dimensions with binary evaluation.
    """
    
    quality_dimensions: str = dspy.InputField(desc="Quality dimensions to evaluate against")
    story_content: str = dspy.InputField(desc="The story to score")
    original_messages: str = dspy.InputField(desc="Source messages for verification")
    
    binary_scores: List[bool] = dspy.OutputField(
        desc="binary scores for each quality dimension, e.g. [True, False, True]"
    )
    overall_score: float = dspy.OutputField(
        desc="overall story quality score from 0.0 to 1.0"
    )
    reasoning: str = dspy.OutputField(
        desc="brief explanation of scoring rationale"
    )


class TopicExtractionQuality(dspy.Signature):
    """
    Evaluate how well topics were extracted from Discord messages.
    """
    
    original_messages = dspy.InputField(desc="Raw Discord messages")
    extracted_topics = dspy.InputField(desc="JSON of extracted topics")
    
    coverage_score: float = dspy.OutputField(desc="How well topics cover the conversations (0-1)")
    uniqueness_score: float = dspy.OutputField(desc="How distinct/non-overlapping topics are (0-1)")  
    relevance_score: float = dspy.OutputField(desc="How relevant/substantial topics are (0-1)")
    overall_score: float = dspy.OutputField(desc="Overall topic extraction quality (0-1)")
    feedback: str = dspy.OutputField(desc="Specific improvement suggestions")


class MessageGroupingSignature(dspy.Signature):
    """
    Group Discord messages into coherent topics with minimal overlap.
    """
    
    discord_messages = dspy.InputField(desc="Raw Discord messages to group by topic")
    
    topic_groups: str = dspy.OutputField(
        desc="JSON object with topic names as keys and arrays of message objects as values"
    )


class StoryGenerationSignature(dspy.Signature):
    """
    Generate a focused news story from Discord messages about a specific topic.
    """
    
    topic_description = dspy.InputField(desc="The specific topic to focus on")
    discord_messages = dspy.InputField(desc="All Discord messages to draw from")
    channel_name = dspy.InputField(desc="Name of the Discord channel")
    
    story: str = dspy.OutputField(
        desc="Complete news story with headline, attribution, and quotes"
    )


# ========== DSPy Programs ==========

class StoryQualityMetric(dspy.Module):
    """
    Comprehensive story quality evaluation using weighted scoring.
    """
    
    def __init__(self):
        self.breakdown = dspy.ChainOfThought(StoryQualityBreakdown)
        self.scoring = dspy.ChainOfThought(StoryQualityScoring)
    
    def forward(self, original_messages: str, story_content: str, trace=None):
        # Get quality dimensions
        breakdown = self.breakdown(
            original_messages=original_messages,
            story_content=story_content
        )
        
        # Score against dimensions
        scoring = self.scoring(
            quality_dimensions=breakdown.quality_dimensions,
            story_content=story_content,
            original_messages=original_messages
        )
        
        try:
            # Weighted scoring like the DSPy example
            weight_map = {'High': 1.0, 'Medium': 0.7, 'Low': 0.3}
            weighted_score = sum(
                weight_map.get(grade, 0.3) * int(binary_score)
                for grade, binary_score in zip(breakdown.importance_grades, scoring.binary_scores)
            )
            total_weight = sum(weight_map.get(grade, 0.3) for grade in breakdown.importance_grades)
            final_score = weighted_score / total_weight if total_weight > 0 else 0.0
            
        except Exception:
            # Fallback to model's overall score
            final_score = float(scoring.overall_score)
        
        result = {
            'score': final_score,
            'dimensions': breakdown.quality_dimensions,
            'binary_scores': scoring.binary_scores,
            'reasoning': scoring.reasoning,
            'grades': breakdown.importance_grades
        }
        
        return final_score if trace is None else (final_score >= 0.75, result)


class TopicExtractionEvaluator(dspy.Module):
    """
    Evaluate topic extraction quality.
    """
    
    def __init__(self):
        self.evaluator = dspy.ChainOfThought(TopicExtractionQuality)
    
    def forward(self, original_messages: str, extracted_topics: str):
        return self.evaluator(
            original_messages=original_messages,
            extracted_topics=extracted_topics
        )


class OptimizedMessageGrouper(dspy.Module):
    """
    DSPy-optimized message grouping.
    """
    
    def __init__(self):
        self.grouper = dspy.ChainOfThought(MessageGroupingSignature)
    
    def forward(self, discord_messages: str):
        return self.grouper(discord_messages=discord_messages)


class OptimizedStoryGenerator(dspy.Module):
    """
    DSPy-optimized story generation.
    """
    
    def __init__(self):
        self.generator = dspy.ChainOfThought(StoryGenerationSignature)
    
    def forward(self, topic_description: str, discord_messages: str, channel_name: str = "channel"):
        return self.generator(
            topic_description=topic_description,
            discord_messages=discord_messages,
            channel_name=channel_name
        )


# ========== Utility Functions ==========

def load_workflow_data(run_name: str) -> WorkflowData:
    """Load all workflow data from a run directory."""
    
    if not run_name:
        # Auto-detect latest run
        workflow_dir = Path("../workflow-runs")
        if not workflow_dir.exists():
            raise ValueError("No workflow-runs directory found")
        
        runs = [d for d in workflow_dir.iterdir() if d.is_dir()]
        if not runs:
            raise ValueError("No workflow runs found")
        
        run_dir = max(runs, key=lambda x: x.stat().st_mtime)
        print(f"📁 Using latest run: {run_dir.name}")
    else:
        run_dir = Path("../workflow-runs") / run_name
        if not run_dir.exists():
            raise ValueError(f"Run directory not found: {run_dir}")
    
    # Load all required files - support both old and new workflow formats
    messages_file = run_dir / "step1-input-messages.json"
    message_map_file = run_dir / "step1-output-message-map.txt" 
    
    # Try new format first (message groups), fallback to old format (topics)
    message_groups_file = run_dir / "step2-output-message-groups.json"
    topics_file = run_dir / "step2-output-topics.json"
    
    raw_response_file = run_dir / "step2-raw-response.txt"
    prompt_file = run_dir / "step2-prompt-template.txt"
    
    # Determine which format we're using
    if message_groups_file.exists():
        topics_data = json.loads(message_groups_file.read_text())
        workflow_format = "new"
    elif topics_file.exists():
        topics_data = json.loads(topics_file.read_text())
        workflow_format = "old"
    else:
        raise ValueError("Neither step2-output-message-groups.json nor step2-output-topics.json found")
    
    # Verify core files exist
    for file_path in [messages_file, message_map_file]:
        if not file_path.exists():
            raise ValueError(f"Required file not found: {file_path}")
    
    return WorkflowData(
        run_dir=run_dir,
        messages=json.loads(messages_file.read_text()),
        message_map=message_map_file.read_text(),
        topics=topics_data,
        raw_response=raw_response_file.read_text() if raw_response_file.exists() else "",
        prompt_template=prompt_file.read_text() if prompt_file.exists() else ""
    )


def evaluate_workflow(run_name: str = None):
    """Evaluate the quality of a workflow run."""
    
    print("🔍 STORY QUALITY EVALUATION")
    print("=" * 60)
    
    # Load workflow data
    data = load_workflow_data(run_name)
    print(f"📁 Evaluating run: {data.run_dir.name}")
    
    # Determine workflow format and show appropriate stats
    if 'topic_groups' in data.topics:
        # New format: message groups
        topic_count = len(data.topics['topic_groups'])
        total_messages = sum(len(msgs) for msgs in data.topics['topic_groups'].values())
        print(f"📊 Message groups found: {topic_count}")
        print(f"📊 Total messages grouped: {total_messages}")
        workflow_format = "new"
    else:
        # Old format: topics list
        topic_count = len(data.topics.get('topics', []))
        print(f"📊 Topics found: {topic_count}")
        workflow_format = "old"
    
    # Initialize evaluators
    story_metric = StoryQualityMetric()
    topic_evaluator = TopicExtractionEvaluator()
    
    # Evaluate topic extraction/message grouping
    print(f"\n📝 Evaluating {'message grouping' if workflow_format == 'new' else 'topic extraction'}...")
    topic_eval = topic_evaluator(
        original_messages=data.message_map,
        extracted_topics=json.dumps(data.topics, indent=2)
    )
    
    print(f"  Coverage: {topic_eval.coverage_score:.2f}")
    print(f"  Uniqueness: {topic_eval.uniqueness_score:.2f}")
    print(f"  Relevance: {topic_eval.relevance_score:.2f}")
    print(f"  Overall: {topic_eval.overall_score:.2f}")
    print(f"  Feedback: {topic_eval.feedback}")
    
    # Evaluate individual stories if they exist (Step 3 output)
    stories_file = data.run_dir / "step3-output-stories.json"
    story_evaluations = {}
    
    if stories_file.exists():
        print(f"\n📰 Evaluating individual stories...")
        stories_data = json.loads(stories_file.read_text())
        
        for topic_name, story_info in stories_data.items():
            print(f"  🔍 Evaluating story: {topic_name}")
            
            # Get the messages for this topic if using new format
            if workflow_format == "new" and topic_name in data.topics['topic_groups']:
                topic_messages = data.topics['topic_groups'][topic_name]
                messages_text = '\n'.join([
                    f"[{msg['timestamp']}] {msg['username']}: {msg['content']}"
                    for msg in topic_messages
                ])
            else:
                # Fallback to using all messages
                messages_text = data.message_map
            
            story_eval = story_metric(
                original_messages=messages_text,
                story_content=story_info['story']
            )
            
            story_evaluations[topic_name] = {
                'score': story_eval if isinstance(story_eval, float) else story_eval[0],
                'message_count': story_info.get('message_count', 0)
            }
            
            print(f"    Score: {story_evaluations[topic_name]['score']:.2f}")
        
        avg_story_score = sum(eval_data['score'] for eval_data in story_evaluations.values()) / len(story_evaluations)
        print(f"\n📊 Average story quality: {avg_story_score:.2f}")
    else:
        print(f"\n⚠️  No stories found (step3-output-stories.json missing)")
        avg_story_score = None
    
    print("\n✅ Evaluation complete!")
    
    # Save evaluation results
    results = {
        'run_name': data.run_dir.name,
        'workflow_format': workflow_format,
        'topic_evaluation': {
            'coverage_score': float(topic_eval.coverage_score),
            'uniqueness_score': float(topic_eval.uniqueness_score),
            'relevance_score': float(topic_eval.relevance_score),
            'overall_score': float(topic_eval.overall_score),
            'feedback': topic_eval.feedback
        },
        'story_evaluations': story_evaluations,
        'average_story_score': avg_story_score,
        'topic_count': topic_count,
        'timestamp': str(__import__('datetime').datetime.now().isoformat())
    }
    
    results_file = data.run_dir / "dspy-evaluation.json"
    results_file.write_text(json.dumps(results, indent=2))
    print(f"💾 Saved evaluation to {results_file}")


def create_grouping_training_data():
    """Create training examples from existing workflow runs."""
    
    print("📚 Creating training dataset from existing runs...")
    
    workflow_dir = Path("../workflow-runs")
    if not workflow_dir.exists():
        return []
    
    training_examples = []
    runs = [d for d in workflow_dir.iterdir() if d.is_dir()]
    
    for run_dir in runs:
        message_map_file = run_dir / "step1-output-message-map.txt"
        groups_file = run_dir / "step2-output-message-groups.json"
        eval_file = run_dir / "dspy-evaluation.json"
        
        if not all(f.exists() for f in [message_map_file, groups_file]):
            continue
            
        # Load data
        message_map = message_map_file.read_text()
        groups_data = json.loads(groups_file.read_text())
        
        # Load evaluation if available
        evaluation_score = None
        if eval_file.exists():
            eval_data = json.loads(eval_file.read_text())
            evaluation_score = eval_data.get('topic_evaluation', {}).get('overall_score', 0.5)
        
        # Create training example
        example = dspy.Example(
            discord_messages=message_map,
            topic_groups=json.dumps(groups_data, indent=2)
        ).with_inputs("discord_messages")
        
        # Add quality score as metadata
        example.quality_score = evaluation_score
        training_examples.append(example)
        
        print(f"  ✅ Added {run_dir.name} (score: {evaluation_score or 'unknown'})")
    
    print(f"📊 Created {len(training_examples)} training examples")
    return training_examples


def optimize_grouping_with_bootstrap(run_name: str = None):
    """Use DSPy BootstrapFewShot to optimize grouping based on existing data."""
    
    print("🚀 REAL DSPy OPTIMIZATION - Learning from Your Data")
    print("=" * 60)
    
    # Create training dataset from existing runs
    training_data = create_grouping_training_data()
    
    if len(training_data) < 2:
        print("❌ Need at least 2 workflow runs to train DSPy optimizer")
        print("   Run more workflows first, then try optimization")
        return
    
    # Load current run data
    data = load_workflow_data(run_name)
    print(f"📁 Optimizing grouping for run: {data.run_dir.name}")
    
    # Create metric function based on our evaluator
    def grouping_quality_metric(example, pred, trace=None):
        evaluator = TopicExtractionEvaluator()
        try:
            eval_result = evaluator(
                original_messages=example.discord_messages,
                extracted_topics=pred.topic_groups
            )
            score = float(eval_result.overall_score)
            return score >= 0.8 if trace else score
        except Exception:
            return False if trace else 0.0
    
    # Initialize grouper and optimizer
    grouper = OptimizedMessageGrouper()
    
    print(f"\n🔄 Training DSPy optimizer with {len(training_data)} examples...")
    
    # Use BootstrapFewShot to learn from examples
    from dspy.teleprompt import BootstrapFewShot
    optimizer = BootstrapFewShot(
        metric=grouping_quality_metric,
        max_bootstrapped_demos=min(3, len(training_data)),
        max_labeled_demos=min(2, len(training_data))
    )
    
    # Compile/optimize the grouper
    optimized_grouper = optimizer.compile(grouper, trainset=training_data)
    
    print("✅ DSPy optimization complete!")
    
    # Test the optimized grouper
    print(f"\n🧪 Testing optimized grouper on {data.run_dir.name}...")
    result = optimized_grouper(discord_messages=data.message_map)
    
    try:
        groups = json.loads(result.topic_groups)
        print(f"📊 Optimized grouping: {len(groups)} groups")
        
        # Evaluate quality
        evaluator = TopicExtractionEvaluator()
        eval_result = evaluator(
            original_messages=data.message_map,
            extracted_topics=result.topic_groups
        )
        
        print(f"  Quality Score: {eval_result.overall_score:.2f}")
        print(f"  Coverage: {eval_result.coverage_score:.2f}")
        print(f"  Uniqueness: {eval_result.uniqueness_score:.2f}")
        print(f"  Relevance: {eval_result.relevance_score:.2f}")
        print(f"  Feedback: {eval_result.feedback}")
        
        # Save results
        optimized_file = data.run_dir / "dspy-bootstrap-optimized.json"
        optimized_file.write_text(json.dumps({
            'optimized_grouping': groups,
            'evaluation': {
                'coverage_score': float(eval_result.coverage_score),
                'uniqueness_score': float(eval_result.uniqueness_score), 
                'relevance_score': float(eval_result.relevance_score),
                'overall_score': float(eval_result.overall_score),
                'feedback': eval_result.feedback
            },
            'training_runs_used': len(training_data),
            'timestamp': str(__import__('datetime').datetime.now().isoformat())
        }, indent=2))
        
        print(f"💾 Saved to {optimized_file}")
        
        # Show what DSPy learned
        print(f"\n🧠 DSPy learned from your {len(training_data)} previous runs")
        print("   It will now adapt grouping strategies based on your data patterns")
        
    except json.JSONDecodeError as e:
        print(f"❌ Failed to parse result: {e}")


def optimize_grouping(run_name: str = None):
    """Wrapper function - use real DSPy optimization if enough data, otherwise test current approach."""
    
    training_data = create_grouping_training_data()
    
    if len(training_data) >= 2:
        optimize_grouping_with_bootstrap(run_name)
    else:
        print("⚠️  Not enough training data for DSPy optimization")
        print(f"   Found {len(training_data)} runs, need at least 2")
        print("   Testing current grouping approach instead...")
        
        # Fall back to simple testing (original function content)
        data = load_workflow_data(run_name)
        grouper = OptimizedMessageGrouper()
        result = grouper(discord_messages=data.message_map)
        
        try:
            groups = json.loads(result.topic_groups)
            print(f"✅ Generated {len(groups)} topic groups (no optimization)")
        except:
            print("❌ Failed to parse grouping result")


def optimize_prompts(run_name: str = None):
    """Use DSPy to optimize prompts for better story generation."""
    
    print("🚀 PROMPT OPTIMIZATION")
    print("=" * 60)
    
    # Load workflow data  
    data = load_workflow_data(run_name)
    print(f"📁 Optimizing prompts for run: {data.run_dir.name}")
    
    # TODO: Implement DSPy optimization once we have a good evaluation dataset
    # This would involve:
    # 1. Creating a training dataset of good/bad examples
    # 2. Using dspy.teleprompt optimizers like BootstrapFewShot or MIPRO
    # 3. Optimizing the story generation prompts
    
    print("⚠️  Optimization not yet implemented - needs training dataset")


def main():
    """Main CLI interface."""
    import argparse
    
    parser = argparse.ArgumentParser(description='DSPy Story Optimization System')
    parser.add_argument('--mode', choices=['evaluate', 'optimize', 'optimize-grouping'], required=True,
                        help='Operation mode')
    parser.add_argument('--run', help='Workflow run name (auto-detect latest if not specified)')
    
    args = parser.parse_args()
    
    # Configure DSPy with OpenAI
    # You'll need to set OPENAI_API_KEY environment variable
    import os
    if not os.getenv('OPENAI_API_KEY'):
        print("❌ OPENAI_API_KEY environment variable required")
        sys.exit(1)
    
    # Use a fast, cheap model for optimization
    lm = dspy.LM('openai/gpt-4o-mini', max_tokens=2000)
    dspy.settings.configure(lm=lm)
    
    try:
        if args.mode == 'evaluate':
            evaluate_workflow(args.run)
        elif args.mode == 'optimize':
            optimize_prompts(args.run)
        elif args.mode == 'optimize-grouping':
            optimize_grouping(args.run)
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)


if __name__ == '__main__':
    main()