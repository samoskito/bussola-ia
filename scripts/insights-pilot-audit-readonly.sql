BEGIN READ ONLY;
SELECT jsonb_build_object(
 'checkedAt',now(),
 'classified',(SELECT count(*) FROM script_insights WHERE status='classified' AND model='gpt-5.4-nano'),
 'byAgent',(SELECT jsonb_object_agg(agent_type,n) FROM (SELECT agent_type,count(*) n FROM script_insights WHERE status='classified' AND model='gpt-5.4-nano' GROUP BY agent_type) a),
 'needsReview',(SELECT count(*) FROM script_insights WHERE needs_review),
 'unclassifiable',(SELECT count(*) FROM script_insights WHERE message_kind='unclassifiable'),
 'adminOrUnknownRows',(SELECT count(*) FROM script_insights i JOIN users u ON u.id=i.user_id WHERE u.nivel IS DISTINCT FROM 'user'),
 'invalidReviewFlags',(SELECT count(*) FROM script_insights WHERE confidence<0.7 AND NOT needs_review),
 'invalidTopicAssignments',(SELECT count(*) FROM script_insights WHERE (message_kind='unclassifiable' AND cardinality(topic_ids)>0) OR (message_kind<>'unclassifiable' AND cardinality(topic_ids)=0) OR cardinality(topic_ids)>3),
 'oversizedSummaries',(SELECT count(*) FROM script_insights WHERE char_length(normalized_demand)>280),
 'jobStates',(SELECT jsonb_object_agg(status,n) FROM (SELECT status,count(*) n FROM insight_jobs GROUP BY status) j),
 'knownUsage',(SELECT jsonb_build_object('input',sum(input_tokens),'output',sum(output_tokens),'estimatedStandardUsd',sum(input_tokens*0.20+output_tokens*1.25)/1000000) FROM insight_jobs WHERE status='completed' AND model='gpt-5.4-nano'),
 'budget',(SELECT jsonb_build_object('scope',scope,'reservedUsd',reserved_usd,'capUsd',cap_usd) FROM insights_budgets WHERE scope='insights-pilot-20261015-v1'),
 'sources',jsonb_build_object('users',(SELECT count(*) FROM users),'chats',(SELECT count(*) FROM chats),'scripts',(SELECT count(*) FROM scripts))
) AS pilot_audit;
COMMIT;
